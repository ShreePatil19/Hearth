import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWeekStart } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const admin = createAdminClient();

  // Fetch all active communities
  const { data: communities, error: commError } = await admin
    .from("communities")
    .select("id")
    .eq("status", "active");

  if (commError) {
    return NextResponse.json({ error: "Failed to fetch communities" }, { status: 500 });
  }

  if (!communities || communities.length === 0) {
    return NextResponse.json({ message: "No active communities" });
  }

  for (const community of communities) {
    try {
      // Compute cohort retention using SQL
      // For each user, find their first active week (cohort).
      // Then count how many from that cohort were active in each subsequent week.
      // The cohort SQL RPC is not deployed yet (see #77), so a "function not
      // found" error (Postgres 42883 / PostgREST PGRST202) is expected and we
      // fall through to the JS implementation below. Any other error is a real
      // failure and is surfaced to the outer catch rather than silently masked.
      // See #83.
      const { data: rpcData, error: rpcError } = await admin.rpc("compute_cohort_retention", {
        p_community_id: community.id,
      });

      if (rpcError && rpcError.code !== "42883" && rpcError.code !== "PGRST202") {
        throw new Error(`compute_cohort_retention failed: ${rpcError.message}`);
      }

      const cohortData = rpcData;

      // If the RPC doesn't exist yet, do it in JS
      if (!cohortData) {
        // Get all message events for this community
        const { data: events } = await admin
          .from("message_events")
          .select("hashed_user_id, ts")
          .eq("community_id", community.id)
          .order("ts", { ascending: true });

        if (!events || events.length === 0) continue;

        // Group by user, find first seen week
        const userFirstWeek: Record<string, string> = {};
        const userActiveWeeks: Record<string, string[]> = {};

        for (const event of events) {
          const weekStart = getWeekStart(new Date(event.ts));
          const userId = event.hashed_user_id;

          if (!userFirstWeek[userId]) {
            userFirstWeek[userId] = weekStart;
          }

          if (!userActiveWeeks[userId]) {
            userActiveWeeks[userId] = [];
          }
          if (!userActiveWeeks[userId].includes(weekStart)) {
            userActiveWeeks[userId].push(weekStart);
          }
        }

        // Build cohort retention matrix
        const cohortRows: {
          community_id: string;
          week_start: string;
          cohort_week: string;
          retained_count: number;
          total_in_cohort: number;
        }[] = [];

        // Group users by their cohort (first seen week)
        const cohorts: Record<string, string[]> = {};
        for (const [userId, firstWeek] of Object.entries(userFirstWeek)) {
          if (!cohorts[firstWeek]) cohorts[firstWeek] = [];
          cohorts[firstWeek].push(userId);
        }

        // For each cohort, count retention in each subsequent week
        for (const [cohortWeek, users] of Object.entries(cohorts)) {
          const allWeeksArr: string[] = [];
          for (const userId of users) {
            for (const week of userActiveWeeks[userId]) {
              if (!allWeeksArr.includes(week)) allWeeksArr.push(week);
            }
          }

          for (const week of allWeeksArr) {
            const retained = users.filter((u) => userActiveWeeks[u].includes(week)).length;
            cohortRows.push({
              community_id: community.id,
              week_start: week,
              cohort_week: cohortWeek,
              retained_count: retained,
              total_in_cohort: users.length,
            });
          }
        }

        if (cohortRows.length > 0) {
          await admin
            .from("cohort_snapshots")
            .upsert(cohortRows, { onConflict: "community_id,week_start,cohort_week" });
        }
      }
    } catch (err) {
      console.error(`Cohort computation error for ${community.id}:`, err);
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    communities_processed: communities.length,
  });
}
