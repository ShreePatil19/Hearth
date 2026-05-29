import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

function mockDeps(opts: { exchangeError: { message: string } | null }) {
  const exchangeSpy = vi.fn().mockResolvedValue({ error: opts.exchangeError });

  vi.doMock("@/lib/rate-limit", () => ({
    rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 0 }),
    authLimiter: {},
  }));
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
      auth: { exchangeCodeForSession: exchangeSpy },
    }),
  }));

  return { exchangeSpy };
}

function buildRequest(query: string): NextRequest {
  return {
    url: `https://hearth.test/auth/callback${query}`,
    headers: {
      get: (k: string) => (k.toLowerCase() === "x-forwarded-for" ? "1.2.3.4" : null),
    },
  } as unknown as NextRequest;
}

describe("auth/callback session-exchange error handling", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/rate-limit");
    vi.doUnmock("@/lib/supabase/server");
  });

  it("redirects to /auth/login (not /dashboard) when the code exchange fails", async () => {
    mockDeps({ exchangeError: { message: "code expired" } });
    const { GET } = await import("@/app/auth/callback/route");

    const res = await GET(buildRequest("?code=abc&redirect=/dashboard"));

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/auth/login");
    expect(location).not.toContain("/dashboard");
  });

  it("redirects to the requested path when the code exchange succeeds", async () => {
    mockDeps({ exchangeError: null });
    const { GET } = await import("@/app/auth/callback/route");

    const res = await GET(buildRequest("?code=abc&redirect=/dashboard"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("/dashboard");
  });

  it("falls back to /dashboard for an open-redirect attempt in the redirect param", async () => {
    mockDeps({ exchangeError: null });
    const { GET } = await import("@/app/auth/callback/route");

    const res = await GET(buildRequest("?code=abc&redirect=//evil.example.com"));

    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/dashboard");
    expect(location).not.toContain("evil.example.com");
  });
});
