import { describe, expect, it } from "vitest";
import { getWeekStart } from "@/app/api/cron/compute-cohorts/route";

describe("getWeekStart (UTC week boundaries)", () => {
  it("returns the preceding Sunday in UTC for the unix epoch", () => {
    // 1970-01-01 is a Thursday (UTC); the week start is Sunday 1969-12-28.
    expect(getWeekStart(new Date("1970-01-01T00:00:00.000Z"))).toBe("1969-12-28");
  });

  it("returns the preceding Sunday for a midweek date", () => {
    // 2024-01-03 is a Wednesday (UTC); the week start is Sunday 2023-12-31.
    expect(getWeekStart(new Date("2024-01-03T15:30:00.000Z"))).toBe("2023-12-31");
  });

  it("is idempotent when the input is already a Sunday", () => {
    expect(getWeekStart(new Date("2023-12-31T23:59:59.000Z"))).toBe("2023-12-31");
  });

  it("always returns a UTC Sunday", () => {
    const samples = [
      "2025-06-12T08:00:00Z",
      "2026-02-28T23:59:00Z",
      "2020-02-29T12:00:00Z",
      "1999-12-31T00:00:00Z",
    ];
    for (const s of samples) {
      const ws = getWeekStart(new Date(s));
      expect(new Date(`${ws}T00:00:00.000Z`).getUTCDay()).toBe(0);
    }
  });

  it("does not shift the week start for a late-UTC-evening timestamp", () => {
    // The local-time bug would shift this; under UTC both map to the same week.
    const lateEvening = getWeekStart(new Date("2024-01-03T23:30:00.000Z"));
    const midday = getWeekStart(new Date("2024-01-03T11:00:00.000Z"));
    expect(lateEvening).toBe(midday);
    expect(lateEvening).toBe("2023-12-31");
  });
});
