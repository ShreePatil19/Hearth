import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

type AdminOpts = {
  existingCommunity?: { id: string } | null;
  insertResult?: { data: { id: string } | null; error: { message: string } | null };
  updateError?: { message: string } | null;
  storeError?: { message: string } | null;
};

function buildAdmin(opts: AdminOpts) {
  const singleSelect = vi.fn().mockResolvedValue({ data: opts.existingCommunity ?? null });
  const singleInsert = vi
    .fn()
    .mockResolvedValue(opts.insertResult ?? { data: { id: "new-community" }, error: null });
  const updateEq = vi.fn().mockResolvedValue({ error: opts.updateError ?? null });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn().mockResolvedValue({ error: opts.storeError ?? null });

  const from = vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ single: singleSelect })) })),
    insert: vi.fn(() => ({ select: vi.fn(() => ({ single: singleInsert })) })),
    update: vi.fn(() => ({ eq: updateEq })),
    upsert,
  }));

  return { from, rpc, _spies: { upsert, updateEq, rpc, singleSelect, singleInsert } };
}

function mockDeps(opts: {
  rateOk?: boolean;
  user?: { id: string } | null;
  admin?: ReturnType<typeof buildAdmin>;
  tokenData?: Record<string, unknown>;
  channelsData?: Record<string, unknown>;
}) {
  vi.doMock("@/lib/rate-limit", () => ({
    rateLimit: vi.fn().mockResolvedValue({ success: opts.rateOk ?? true, remaining: 0 }),
    apiLimiter: {},
  }));
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: opts.user === undefined ? { id: "u1" } : opts.user } }),
      },
    }),
  }));
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: vi.fn(() => opts.admin ?? buildAdmin({})),
  }));

  const tokenData = opts.tokenData ?? {
    ok: true,
    access_token: "xoxb-token",
    team: { id: "T1", name: "Acme" },
    scope: "channels:read,users:read",
  };
  const channelsData = opts.channelsData ?? {
    ok: true,
    channels: [{ id: "C1", name: "general", is_private: false, num_members: 12 }],
  };

  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.includes("oauth.v2.access")) {
      return Promise.resolve({ json: async () => tokenData });
    }
    if (url.includes("conversations.list")) {
      return Promise.resolve({ json: async () => channelsData });
    }
    return Promise.resolve({ json: async () => ({}) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock };
}

function buildRequest(query: string, stateCookie?: string): NextRequest {
  return {
    url: `https://hearth.test/api/slack/callback${query}`,
    headers: { get: (k: string) => (k.toLowerCase() === "x-forwarded-for" ? "1.2.3.4" : null) },
    cookies: {
      get: (name: string) =>
        name === "slack_oauth_state" && stateCookie ? { value: stateCookie } : undefined,
    },
  } as unknown as NextRequest;
}

const STATE = "valid-state";

describe("slack/callback GET", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.SLACK_CLIENT_ID = "client-id";
    process.env.SLACK_CLIENT_SECRET = "client-secret";
    process.env.NEXT_PUBLIC_SITE_URL = "https://hearth.test";
    process.env.TOKEN_ENCRYPTION_KEY = "enc-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.doUnmock("@/lib/rate-limit");
    vi.doUnmock("@/lib/supabase/server");
    vi.doUnmock("@/lib/supabase/admin");
    delete process.env.SLACK_CLIENT_ID;
    delete process.env.SLACK_CLIENT_SECRET;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("returns 429 when rate limited", async () => {
    mockDeps({ rateOk: false });
    const { GET } = await import("@/app/api/slack/callback/route");

    const res = await GET(buildRequest("?code=abc&state=valid-state", STATE));

    expect(res.status).toBe(429);
  });

  it("redirects to dashboard with the error when Slack reports a denial", async () => {
    mockDeps({});
    const { GET } = await import("@/app/api/slack/callback/route");

    const res = await GET(buildRequest("?error=access_denied", STATE));

    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/dashboard?error=access_denied");
  });

  it("rejects a mismatched CSRF state", async () => {
    mockDeps({});
    const { GET } = await import("@/app/api/slack/callback/route");

    const res = await GET(buildRequest("?code=abc&state=attacker", STATE));

    expect(res.headers.get("location") ?? "").toContain("Invalid%20OAuth%20state");
  });

  it("rejects a missing CSRF state cookie", async () => {
    mockDeps({});
    const { GET } = await import("@/app/api/slack/callback/route");

    const res = await GET(buildRequest("?code=abc&state=valid-state"));

    expect(res.headers.get("location") ?? "").toContain("Invalid%20OAuth%20state");
  });

  it("rejects a request with valid state but no code", async () => {
    mockDeps({});
    const { GET } = await import("@/app/api/slack/callback/route");

    const res = await GET(buildRequest("?state=valid-state", STATE));

    expect(res.headers.get("location") ?? "").toContain("No%20authorization%20code");
  });

  it("redirects unauthenticated users to login", async () => {
    mockDeps({ user: null });
    const { GET } = await import("@/app/api/slack/callback/route");

    const res = await GET(buildRequest("?code=abc&state=valid-state", STATE));

    expect(res.headers.get("location") ?? "").toContain("/auth/login");
  });

  it("redirects with the Slack error when token exchange fails", async () => {
    mockDeps({ tokenData: { ok: false, error: "invalid_code" } });
    const { GET } = await import("@/app/api/slack/callback/route");

    const res = await GET(buildRequest("?code=abc&state=valid-state", STATE));

    expect(res.headers.get("location") ?? "").toContain("invalid_code");
  });

  it("updates an existing community, stores the token, syncs channels, and redirects to settings", async () => {
    const admin = buildAdmin({ existingCommunity: { id: "existing-community" } });
    mockDeps({ admin });
    const { GET } = await import("@/app/api/slack/callback/route");

    const res = await GET(buildRequest("?code=abc&state=valid-state", STATE));

    expect(admin._spies.updateEq).toHaveBeenCalled();
    expect(admin._spies.rpc).toHaveBeenCalledWith("store_integration", expect.objectContaining({ p_community_id: "existing-community" }));
    expect(admin._spies.upsert).toHaveBeenCalled();
    expect(res.headers.get("location") ?? "").toContain("/dashboard/existing-community/settings");
    expect(res.cookies.get("slack_oauth_state")?.value).toBe("");
  });

  it("creates a new community and redirects to its settings", async () => {
    const admin = buildAdmin({ existingCommunity: null, insertResult: { data: { id: "new-community" }, error: null } });
    mockDeps({ admin });
    const { GET } = await import("@/app/api/slack/callback/route");

    const res = await GET(buildRequest("?code=abc&state=valid-state", STATE));

    expect(admin._spies.singleInsert).toHaveBeenCalled();
    expect(res.headers.get("location") ?? "").toContain("/dashboard/new-community/settings");
  });

  it("redirects with an error when community creation fails", async () => {
    const admin = buildAdmin({ existingCommunity: null, insertResult: { data: null, error: { message: "insert failed" } } });
    mockDeps({ admin });
    const { GET } = await import("@/app/api/slack/callback/route");

    const res = await GET(buildRequest("?code=abc&state=valid-state", STATE));

    expect(res.headers.get("location") ?? "").toContain("Failed%20to%20create%20community");
  });

  it("redirects with an error when token storage fails", async () => {
    const admin = buildAdmin({ existingCommunity: { id: "existing-community" }, storeError: { message: "store failed" } });
    mockDeps({ admin });
    const { GET } = await import("@/app/api/slack/callback/route");

    const res = await GET(buildRequest("?code=abc&state=valid-state", STATE));

    expect(res.headers.get("location") ?? "").toContain("Failed%20to%20store%20Slack%20token");
  });

  it("redirects with an error and does not store a token when updating an existing community fails", async () => {
    const admin = buildAdmin({
      existingCommunity: { id: "existing-community" },
      updateError: { message: "update failed" },
    });
    mockDeps({ admin });
    const { GET } = await import("@/app/api/slack/callback/route");

    const res = await GET(buildRequest("?code=abc&state=valid-state", STATE));

    expect(res.headers.get("location") ?? "").toContain("Failed%20to%20update%20community");
    expect(admin._spies.rpc).not.toHaveBeenCalled();
  });

  it("redirects to settings with a warning when Slack channel sync fails", async () => {
    const admin = buildAdmin({ existingCommunity: { id: "existing-community" } });
    mockDeps({ admin, channelsData: { ok: false, error: "invalid_auth" } });
    const { GET } = await import("@/app/api/slack/callback/route");

    const res = await GET(buildRequest("?code=abc&state=valid-state", STATE));

    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/dashboard/existing-community/settings");
    expect(location).toContain("warning=channel_sync_failed");
    expect(admin._spies.upsert).not.toHaveBeenCalled();
  });
});
