import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = Record<string, unknown>;

/**
 * FIFO chainable admin stub: every builder method returns the same thenable
 * object, so each awaited query/rpc shifts the next queued result. The route
 * awaits its DB calls sequentially, so queue order mirrors call order.
 */
function makeAdmin(results: QueryResult[]) {
  const queue = [...results];
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "insert", "update", "upsert", "eq", "single", "order", "gte", "lt"]) {
    builder[m] = vi.fn(() => builder);
  }
  (builder as { then?: unknown }).then = (resolve: (v: QueryResult) => unknown) => {
    const next = queue.length > 0 ? (queue.shift() as QueryResult) : {};
    return Promise.resolve(resolve(next));
  };
  return { from: vi.fn(() => builder), rpc: vi.fn(() => builder) };
}

function mockDeps(adminResults: QueryResult[], fetchImpl?: () => Promise<unknown>) {
  const notify = vi.fn().mockResolvedValue(undefined);
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: vi.fn(() => makeAdmin(adminResults)),
  }));
  vi.doMock("@/lib/notifications", () => ({ sendFailureNotification: notify }));
  if (fetchImpl) {
    vi.stubGlobal("fetch", vi.fn(fetchImpl));
  }
  return { notify };
}

describe("ingest-slack cron GET", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.TOKEN_ENCRYPTION_KEY = "enc-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.doUnmock("@/lib/supabase/admin");
    vi.doUnmock("@/lib/notifications");
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("returns a generic 500 with no detail leak when the communities query errors", async () => {
    mockDeps([{ data: null, error: { message: "connection reset" } }]);
    const { GET } = await import("@/app/api/cron/ingest-slack/route");

    const res = await GET();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Failed to fetch communities" });
    expect(body).not.toHaveProperty("detail");
    expect(JSON.stringify(body)).not.toContain("connection reset");
  });

  it("succeeds with no communities to process", async () => {
    mockDeps([{ data: [], error: null }]);
    const { GET } = await import("@/app/api/cron/ingest-slack/route");

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.communities_processed).toBe(0);
    expect(body.status).toBe("success");
  });

  it("marks a community as skipped when no channels are opted in", async () => {
    mockDeps([
      { data: [{ id: "com1", salt: "s", slack_team_id: "T1", status: "active" }], error: null },
      { data: { id: "log1" } }, // ingest_log insert
      { data: [{ access_token: "xoxb" }] }, // get_decrypted_token rpc
      { data: [] }, // channels (none opted in)
      {}, // ingest_log update
    ]);
    const { GET } = await import("@/app/api/cron/ingest-slack/route");

    const res = await GET();

    const body = await res.json();
    expect(body.results).toEqual([{ community: "com1", status: "skipped", messages: 0 }]);
    expect(body.status).toBe("success");
  });

  it("records an error and notifies when the token cannot be decrypted", async () => {
    const { notify } = mockDeps([
      { data: [{ id: "com1", salt: "s" }], error: null },
      { data: { id: "log1" } }, // ingest_log insert
      { data: null }, // get_decrypted_token rpc -> throws "No token found"
      {}, // ingest_log error update
    ]);
    const { GET } = await import("@/app/api/cron/ingest-slack/route");

    const res = await GET();

    const body = await res.json();
    expect(body.status).toBe("partial_failure");
    expect(body.results[0]).toEqual(
      expect.objectContaining({ community: "com1", status: "error", error: "No token found" }),
    );
    expect(notify).toHaveBeenCalledOnce();
  });

  it("ingests message metadata for opted-in channels", async () => {
    mockDeps(
      [
        { data: [{ id: "com1", salt: "s", slack_team_id: "T1", status: "active" }], error: null },
        { data: { id: "log1" } }, // ingest_log insert
        { data: [{ access_token: "xoxb" }] }, // get_decrypted_token rpc
        { data: [{ id: "c1", platform_channel_id: "C1" }] }, // channels
        {}, // message_events upsert
        {}, // ingest_log success update
      ],
      async () => ({
        json: async () => ({
          ok: true,
          messages: [{ user: "U1", ts: "1700000000.000100", text: "hi", reactions: [] }],
          response_metadata: { next_cursor: "" },
        }),
      }),
    );
    const { GET } = await import("@/app/api/cron/ingest-slack/route");

    const res = await GET();

    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.results[0]).toEqual({ community: "com1", status: "success", messages: 1 });
  }, 10000);

  it("marks the community partial and notifies when Slack returns a channel API error", async () => {
    const { notify } = mockDeps(
      [
        { data: [{ id: "com1", salt: "s", slack_team_id: "T1", status: "active" }], error: null },
        { data: { id: "log1" } },
        { data: [{ access_token: "xoxb" }] },
        { data: [{ id: "c1", platform_channel_id: "C1" }] },
        {}, // ingest_log error update
      ],
      async () => ({ json: async () => ({ ok: false, error: "channel_not_found" }) }),
    );
    const { GET } = await import("@/app/api/cron/ingest-slack/route");

    const res = await GET();

    const body = await res.json();
    expect(body.status).toBe("partial_failure");
    expect(body.results[0]).toEqual({
      community: "com1",
      status: "partial",
      messages: 0,
      error: "C1: channel_not_found",
    });
    expect(notify).toHaveBeenCalledOnce();
  }, 10000);

  it("marks the community partial and notifies when a per-channel fetch throws", async () => {
    const { notify } = mockDeps(
      [
        { data: [{ id: "com1", salt: "s", slack_team_id: "T1", status: "active" }], error: null },
        { data: { id: "log1" } },
        { data: [{ access_token: "xoxb" }] },
        { data: [{ id: "c1", platform_channel_id: "C1" }] },
        {}, // ingest_log error update
      ],
      async () => {
        throw new Error("network down");
      },
    );
    const { GET } = await import("@/app/api/cron/ingest-slack/route");

    const res = await GET();

    const body = await res.json();
    expect(body.status).toBe("partial_failure");
    expect(body.results[0]).toEqual({
      community: "com1",
      status: "partial",
      messages: 0,
      error: "C1: network down",
    });
    expect(notify).toHaveBeenCalledOnce();
  });

  it("continues without a log id and surfaces the failure when ingest_log insert errors", async () => {
    mockDeps([
      { data: [{ id: "com1", salt: "s", slack_team_id: "T1", status: "active" }], error: null },
      { data: null, error: { message: "ingest_log insert failed" } }, // ingest_log insert errors
      { data: [{ access_token: "xoxb" }] }, // get_decrypted_token rpc
      { data: [] }, // channels (none opted in); the log update is guarded out
    ]);
    const { GET } = await import("@/app/api/cron/ingest-slack/route");

    const res = await GET();

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.results).toEqual([{ community: "com1", status: "skipped", messages: 0 }]);
    expect(console.error).toHaveBeenCalledWith(
      "[cron/ingest-slack] failed to create ingest_log entry:",
      { message: "ingest_log insert failed" },
    );
  });
});
