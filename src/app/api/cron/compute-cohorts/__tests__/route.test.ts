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

type QueryResult = Record<string, unknown>;

/**
 * FIFO chainable admin stub: awaited queries/rpcs resolve to queued results in
 * call order. compute-cohorts awaits its DB calls sequentially.
 */
function makeAdminFifo(results: QueryResult[]) {
  const queue = [...results];
  const upsert = vi.fn(() => builder);
  const builder: Record<string, unknown> = { upsert };
  for (const m of ["select", "eq", "order"]) builder[m] = vi.fn(() => builder);
  (builder as { then?: unknown }).then = (resolve: (v: QueryResult) => unknown) => {
    const next = queue.length > 0 ? (queue.shift() as QueryResult) : {};
    return Promise.resolve(resolve(next));
  };
  return { client: { from: vi.fn(() => builder), rpc: vi.fn(() => builder) }, upsert };
}

describe("compute-cohorts cron — cohort computation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("@/lib/supabase/admin");
  });

  it("uses the RPC result when available and skips the JS fallback", async () => {
    const { client, upsert } = makeAdminFifo([
      { data: [{ id: "com1" }], error: null }, // communities
      { data: [{ cohort_week: "2026-01-05" }] }, // rpc returns precomputed data
    ]);
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => client) }));
    const { GET } = await import("@/app/api/cron/compute-cohorts/route");

    const res = await GET();

    const body = await res.json();
    expect(body.communities_processed).toBe(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("computes cohorts in JS and upserts snapshots when the RPC returns nothing", async () => {
    const { client, upsert } = makeAdminFifo([
      { data: [{ id: "com1" }], error: null }, // communities
      { data: null }, // rpc -> fall through to JS
      {
        data: [
          { hashed_user_id: "u1", ts: "2026-01-06T10:00:00.000Z" },
          { hashed_user_id: "u1", ts: "2026-01-13T10:00:00.000Z" },
        ],
      }, // message_events
      {}, // cohort_snapshots upsert
    ]);
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => client) }));
    const { GET } = await import("@/app/api/cron/compute-cohorts/route");

    const res = await GET();

    const body = await res.json();
    expect(body.communities_processed).toBe(1);
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("skips a community with no message events", async () => {
    const { client, upsert } = makeAdminFifo([
      { data: [{ id: "com1" }], error: null }, // communities
      { data: null }, // rpc
      { data: [] }, // message_events empty -> continue
    ]);
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => client) }));
    const { GET } = await import("@/app/api/cron/compute-cohorts/route");

    const res = await GET();

    const body = await res.json();
    expect(body.communities_processed).toBe(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("surfaces an unexpected RPC error instead of silently falling through", async () => {
    const { client, upsert } = makeAdminFifo([
      { data: [{ id: "com1" }], error: null }, // communities
      { data: null, error: { code: "57014", message: "statement timeout" } }, // rpc real error
    ]);
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => client) }));
    const { GET } = await import("@/app/api/cron/compute-cohorts/route");

    const res = await GET();

    const body = await res.json();
    expect(body.communities_processed).toBe(1);
    expect(upsert).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});
