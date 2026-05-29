import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getChannelBreakdown,
  getCohortRetention,
  getDashboardMetrics,
  getLurkerRatio,
  getMessageVolume,
  getNewVsReturning,
  getTopContributors,
} from "@/lib/dashboard-queries";

type QueryResult = Record<string, unknown>;

/**
 * Builds a Supabase stub whose query chains resolve, in FIFO order, to the
 * supplied results. Every builder method returns the same chainable object,
 * which is thenable — each awaited query shifts the next result off the queue.
 * The functions under test await their queries sequentially, so queue order
 * mirrors call order.
 */
function makeSupabase(results: QueryResult[]): SupabaseClient {
  const queue = [...results];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lt", "order"]) {
    builder[method] = vi.fn(() => builder);
  }
  (builder as { then?: unknown }).then = (resolve: (v: QueryResult) => unknown) => {
    const next = queue.length > 0 ? (queue.shift() as QueryResult) : {};
    return Promise.resolve(resolve(next));
  };
  return { from: vi.fn(() => builder) } as unknown as SupabaseClient;
}

const COMMUNITY = "11111111-1111-4111-8111-111111111111";

describe("getDashboardMetrics", () => {
  it("aggregates totals, unique users, thread percentage and DAU", async () => {
    const supabase = makeSupabase([
      { count: 100 },
      { data: [{ hashed_user_id: "a" }, { hashed_user_id: "a" }, { hashed_user_id: "b" }] },
      { data: [{ has_thread: true }] },
      { data: [{ hashed_user_id: "a" }] },
    ]);

    const result = await getDashboardMetrics(supabase, COMMUNITY, "30d");

    expect(result).toEqual({
      totalMessages: 100,
      activeUsers: 2,
      dau: 1,
      threadPercentage: 1,
    });
  });

  it("returns zeroed metrics when there is no data", async () => {
    const supabase = makeSupabase([{}, {}, {}, {}]);

    const result = await getDashboardMetrics(supabase, COMMUNITY, "7d");

    expect(result).toEqual({
      totalMessages: 0,
      activeUsers: 0,
      dau: 0,
      threadPercentage: 0,
    });
  });
});

describe("getMessageVolume", () => {
  it("buckets events by day and fills the date range", async () => {
    const today = new Date().toISOString();
    const supabase = makeSupabase([
      { data: [{ ts: today }, { ts: today }, { ts: today }] },
    ]);

    const result = await getMessageVolume(supabase, COMMUNITY, "7d");

    expect(result.length).toBeGreaterThanOrEqual(7);
    expect(result[0]).toEqual(expect.objectContaining({ date: expect.any(String), messages: expect.any(Number) }));
    expect(result.reduce((sum, r) => sum + r.messages, 0)).toBe(3);
  });

  it("returns an empty array when there is no data", async () => {
    const supabase = makeSupabase([{ data: null }]);
    expect(await getMessageVolume(supabase, COMMUNITY, "30d")).toEqual([]);
  });
});

describe("getChannelBreakdown", () => {
  it("counts messages per opted-in channel and sorts descending", async () => {
    const supabase = makeSupabase([
      { data: [{ id: "c1", name: "general" }, { id: "c2", name: "random" }] },
      { count: 5 },
      { count: 10 },
    ]);

    const result = await getChannelBreakdown(supabase, COMMUNITY, "90d");

    expect(result).toEqual([
      { name: "#random", messages: 10 },
      { name: "#general", messages: 5 },
    ]);
  });

  it("returns an empty array when there are no channels", async () => {
    const supabase = makeSupabase([{ data: null }]);
    expect(await getChannelBreakdown(supabase, COMMUNITY, "7d")).toEqual([]);
  });

  it("treats a null message count as zero", async () => {
    const supabase = makeSupabase([
      { data: [{ id: "c1", name: "general" }] },
      { count: null },
    ]);
    expect(await getChannelBreakdown(supabase, COMMUNITY, "30d")).toEqual([
      { name: "#general", messages: 0 },
    ]);
  });
});

describe("getTopContributors", () => {
  it("ranks anonymised contributors by message count", async () => {
    const supabase = makeSupabase([
      {
        data: [
          { hashed_user_id: "aaaaaaaa11" },
          { hashed_user_id: "aaaaaaaa11" },
          { hashed_user_id: "bbbbbbbb22" },
        ],
      },
    ]);

    const result = await getTopContributors(supabase, COMMUNITY, "30d");

    expect(result).toEqual([
      { rank: 1, label: "Contributor #1", hashPreview: "aaaaaaaa", messages: 2 },
      { rank: 2, label: "Contributor #2", hashPreview: "bbbbbbbb", messages: 1 },
    ]);
  });

  it("respects the limit argument", async () => {
    const supabase = makeSupabase([
      { data: [{ hashed_user_id: "a" }, { hashed_user_id: "b" }, { hashed_user_id: "c" }] },
    ]);

    const result = await getTopContributors(supabase, COMMUNITY, "30d", 1);

    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe(1);
  });

  it("returns an empty array when there is no data", async () => {
    const supabase = makeSupabase([{}]);
    expect(await getTopContributors(supabase, COMMUNITY, "30d")).toEqual([]);
  });
});

describe("getNewVsReturning", () => {
  it("classifies range users as new or returning against prior activity", async () => {
    const supabase = makeSupabase([
      { data: [{ hashed_user_id: "u1" }] },
      { data: [{ hashed_user_id: "u1" }, { hashed_user_id: "u2" }] },
    ]);

    const result = await getNewVsReturning(supabase, COMMUNITY, "30d");

    expect(result).toEqual({ new: 1, returning: 1 });
  });

  it("returns zeroes when there is no activity", async () => {
    const supabase = makeSupabase([{}, {}]);
    expect(await getNewVsReturning(supabase, COMMUNITY, "7d")).toEqual({ new: 0, returning: 0 });
  });
});

describe("getCohortRetention", () => {
  it("returns ordered cohort snapshot rows", async () => {
    const rows = [{ cohort_week: "2026-01-05", week_start: "2026-01-05", retained_count: 3 }];
    const supabase = makeSupabase([{ data: rows }]);

    expect(await getCohortRetention(supabase, COMMUNITY)).toEqual(rows);
  });

  it("returns an empty array when there are no snapshots", async () => {
    const supabase = makeSupabase([{ data: null }]);
    expect(await getCohortRetention(supabase, COMMUNITY)).toEqual([]);
  });
});

describe("getLurkerRatio", () => {
  it("sums member counts and counts unique active posters", async () => {
    const supabase = makeSupabase([
      { data: [{ member_count: 10 }, { member_count: 5 }, { member_count: null }] },
      { data: [{ hashed_user_id: "a" }, { hashed_user_id: "a" }, { hashed_user_id: "b" }] },
    ]);

    const result = await getLurkerRatio(supabase, COMMUNITY, "7d");

    expect(result).toEqual({ totalMembers: 15, activePosters: 2 });
  });

  it("returns zeroes when there is no data", async () => {
    const supabase = makeSupabase([{}, {}]);
    expect(await getLurkerRatio(supabase, COMMUNITY, "30d")).toEqual({ totalMembers: 0, activePosters: 0 });
  });
});
