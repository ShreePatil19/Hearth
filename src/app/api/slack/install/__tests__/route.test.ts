import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

function mockDeps(opts: { rateOk?: boolean; user?: { id: string } | null }) {
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
}

function buildRequest(): NextRequest {
  return {
    url: "https://hearth.test/api/slack/install",
    headers: { get: (k: string) => (k.toLowerCase() === "x-forwarded-for" ? "1.2.3.4" : null) },
  } as unknown as NextRequest;
}

describe("slack/install GET", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SLACK_CLIENT_ID = "client-id";
    process.env.NEXT_PUBLIC_SITE_URL = "https://hearth.test";
  });

  afterEach(() => {
    vi.doUnmock("@/lib/rate-limit");
    vi.doUnmock("@/lib/supabase/server");
    delete process.env.SLACK_CLIENT_ID;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("returns 429 when the request is rate limited", async () => {
    mockDeps({ rateOk: false });
    const { GET } = await import("@/app/api/slack/install/route");

    const res = await GET(buildRequest());

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({ error: "Too many requests" });
  });

  it("redirects unauthenticated users to login", async () => {
    mockDeps({ rateOk: true, user: null });
    const { GET } = await import("@/app/api/slack/install/route");

    const res = await GET(buildRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login");
  });

  it("redirects authenticated users to Slack OAuth with a CSRF state cookie", async () => {
    mockDeps({ rateOk: true, user: { id: "u1" } });
    const { GET } = await import("@/app/api/slack/install/route");

    const res = await GET(buildRequest());

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("slack.com/oauth/v2/authorize");
    expect(location).toContain("client_id=client-id");
    expect(location).toContain("scope=");
    expect(location).toContain("state=");
    expect(location).toContain("redirect_uri=");

    const stateCookie = res.cookies.get("slack_oauth_state");
    expect(stateCookie?.value).toMatch(/^[0-9a-f]{32}$/);

    // The state in the redirect URL must equal the state stored in the cookie
    const urlState = new URL(location).searchParams.get("state");
    expect(urlState).toBe(stateCookie?.value);
  });
});
