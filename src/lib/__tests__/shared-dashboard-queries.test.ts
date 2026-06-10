import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/dashboard-queries", () => ({
  getDashboardMetrics: vi.fn(async () => ({
    totalMessages: 1,
    activeUsers: 1,
    dau: 1,
    threadPercentage: 1,
  })),
  getMessageVolume: vi.fn(async () => [{ date: "2026-01-01", messages: 1 }]),
  getChannelBreakdown: vi.fn(async () => [{ name: "#general", messages: 1 }]),
  getTopContributors: vi.fn(async () => [
    { rank: 1, label: "Contributor #1", hashPreview: "abcd1234", messages: 1 },
  ]),
  getNewVsReturning: vi.fn(async () => ({ new: 1, returning: 0 })),
}));

import { getSharedDashboardData } from "@/lib/shared-dashboard-queries";
import {
  getDashboardMetrics,
  getMessageVolume,
  getChannelBreakdown,
  getTopContributors,
  getNewVsReturning,
} from "@/lib/dashboard-queries";

const admin = { from: vi.fn() } as unknown as SupabaseClient;
const COMMUNITY = "11111111-1111-4111-8111-111111111111";

describe("getSharedDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls every query with the trusted communityId and a fixed 30d range", async () => {
    await getSharedDashboardData(admin, COMMUNITY);

    for (const fn of [
      getDashboardMetrics,
      getMessageVolume,
      getChannelBreakdown,
      getTopContributors,
      getNewVsReturning,
    ]) {
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(admin, COMMUNITY, "30d");
    }
  });

  it("bundles the underlying query results", async () => {
    const result = await getSharedDashboardData(admin, COMMUNITY);

    expect(result).toEqual({
      metrics: { totalMessages: 1, activeUsers: 1, dau: 1, threadPercentage: 1 },
      volume: [{ date: "2026-01-01", messages: 1 }],
      channels: [{ name: "#general", messages: 1 }],
      contributors: [
        { rank: 1, label: "Contributor #1", hashPreview: "abcd1234", messages: 1 },
      ],
      newVsReturning: { new: 1, returning: 0 },
    });
  });
});
