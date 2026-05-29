import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function mockAdmin(result: { data: unknown; error: { message: string } | null }) {
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve(result),
        }),
      }),
    }),
  }));
}

describe("compute-cohorts cron — communities fetch error handling", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/supabase/admin");
  });

  it("returns 500 when the communities query errors instead of reporting success", async () => {
    mockAdmin({ data: null, error: { message: "connection reset" } });
    const { GET } = await import("@/app/api/cron/compute-cohorts/route");

    const res = await GET();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Failed to fetch communities" });
  });

  it("returns 200 'No active communities' when the query succeeds with no rows", async () => {
    mockAdmin({ data: [], error: null });
    const { GET } = await import("@/app/api/cron/compute-cohorts/route");

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ message: "No active communities" });
  });
});
