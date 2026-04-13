import { SupabaseClient } from "@supabase/supabase-js";

type Range = "7d" | "30d" | "90d";

function getRangeDate(range: Range): string {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function getDashboardMetrics(
  supabase: SupabaseClient,
  communityId: string,
  range: Range
) {
  const since = getRangeDate(range);

  const { count: totalMessages } = await supabase
    .from("message_events")
    .select("*", { count: "exact", head: true })
    .eq("community_id", communityId)
    .gte("ts", since);

  const { data: uniqueUsers } = await supabase
    .from("message_events")
    .select("hashed_user_id")
    .eq("community_id", communityId)
    .gte("ts", since);

  const uniqueUserCount = new Set(uniqueUsers?.map((u) => u.hashed_user_id)).size;

  const { data: threadMessages } = await supabase
    .from("message_events")
    .select("has_thread")
    .eq("community_id", communityId)
    .eq("has_thread", true)
    .gte("ts", since);

  const threadCount = threadMessages?.length || 0;
  const threadPct = totalMessages ? Math.round((threadCount / totalMessages) * 100) : 0;

  // DAU (today)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: todayUsers } = await supabase
    .from("message_events")
    .select("hashed_user_id")
    .eq("community_id", communityId)
    .gte("ts", todayStart.toISOString());

  const dau = new Set(todayUsers?.map((u) => u.hashed_user_id)).size;

  return {
    totalMessages: totalMessages || 0,
    activeUsers: uniqueUserCount,
    dau,
    threadPercentage: threadPct,
  };
}

export async function getMessageVolume(
  supabase: SupabaseClient,
  communityId: string,
  range: Range
) {
  const since = getRangeDate(range);

  const { data } = await supabase
    .from("message_events")
    .select("ts")
    .eq("community_id", communityId)
    .gte("ts", since)
    .order("ts", { ascending: true });

  if (!data) return [];

  // Group by date
  const grouped: Record<string, number> = {};
  for (const event of data) {
    const date = new Date(event.ts).toISOString().split("T")[0];
    grouped[date] = (grouped[date] || 0) + 1;
  }

  // Fill missing dates
  const result: { date: string; messages: number }[] = [];
  const startDate = new Date(since);
  const endDate = new Date();

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    result.push({ date: dateStr, messages: grouped[dateStr] || 0 });
  }

  return result;
}

export async function getChannelBreakdown(
  supabase: SupabaseClient,
  communityId: string,
  range: Range
) {
  const since = getRangeDate(range);

  const { data: channels } = await supabase
    .from("channels")
    .select("id, name")
    .eq("community_id", communityId)
    .eq("opted_in", true);

  if (!channels) return [];

  const result: { name: string; messages: number }[] = [];

  for (const channel of channels) {
    const { count } = await supabase
      .from("message_events")
      .select("*", { count: "exact", head: true })
      .eq("channel_id", channel.id)
      .gte("ts", since);

    result.push({ name: `#${channel.name}`, messages: count || 0 });
  }

  return result.sort((a, b) => b.messages - a.messages);
}

export async function getTopContributors(
  supabase: SupabaseClient,
  communityId: string,
  range: Range,
  limit = 10
) {
  const since = getRangeDate(range);

  const { data } = await supabase
    .from("message_events")
    .select("hashed_user_id")
    .eq("community_id", communityId)
    .gte("ts", since);

  if (!data) return [];

  // Count per user
  const counts: Record<string, number> = {};
  for (const event of data) {
    counts[event.hashed_user_id] = (counts[event.hashed_user_id] || 0) + 1;
  }

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([hash, count], i) => ({
      rank: i + 1,
      label: `Contributor #${i + 1}`,
      hashPreview: hash.slice(0, 8),
      messages: count,
    }));
}

export async function getNewVsReturning(
  supabase: SupabaseClient,
  communityId: string,
  range: Range
) {
  const since = getRangeDate(range);

  // All-time users (before the range)
  const { data: allTimeBefore } = await supabase
    .from("message_events")
    .select("hashed_user_id")
    .eq("community_id", communityId)
    .lt("ts", since);

  const beforeIds = allTimeBefore?.map((u) => u.hashed_user_id) || [];

  // Users in range
  const { data: rangeUsers } = await supabase
    .from("message_events")
    .select("hashed_user_id")
    .eq("community_id", communityId)
    .gte("ts", since);

  // Deduplicate range users
  const rangeIds: string[] = [];
  for (const u of rangeUsers || []) {
    if (!rangeIds.includes(u.hashed_user_id)) rangeIds.push(u.hashed_user_id);
  }

  let newUsers = 0;
  let returning = 0;

  for (const userId of rangeIds) {
    if (beforeIds.includes(userId)) {
      returning++;
    } else {
      newUsers++;
    }
  }

  return { new: newUsers, returning };
}

export async function getCohortRetention(
  supabase: SupabaseClient,
  communityId: string
) {
  const { data } = await supabase
    .from("cohort_snapshots")
    .select("*")
    .eq("community_id", communityId)
    .order("cohort_week", { ascending: true })
    .order("week_start", { ascending: true });

  return data || [];
}
