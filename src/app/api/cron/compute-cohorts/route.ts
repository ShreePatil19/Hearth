import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function GET() {
  const admin = createAdminClient();

  // Fetch all active communities
  const { data: communities } = await admin
    .from("communities")
    .select("id")
    .eq("status", "active");

  if (!communities || communities.length === 0) {
    return NextResponse.json({ message: "No active communities" });
  }

  for (const community of communities) {
    try {
      // Compute cohort retention using SQL
      // For each user, find their first active week (cohort).
      // Then count how many from that cohort were active in each subsequent week.
      let cohortData = null;
      try {
        const result = await admin.rpc("compute_cohort_retention" as string, {
          p_community_id: community.id,
        });
        cohortData = result.data;
      } catch {
        // RPC doesn't exist — fall through to JS implementation
      }

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

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}
