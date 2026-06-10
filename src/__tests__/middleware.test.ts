import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

type MockProfile = { status: string; is_admin: boolean } | null;
type MockUser = { id: string } | null;

function setupMiddlewareMocks(opts: { user: MockUser; profile: MockProfile }) {
  vi.doMock("@/lib/supabase/middleware", () => ({
    createMiddlewareClient: () => ({
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: opts.user } }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: opts.profile }),
            }),
          }),
        }),
      },
      response: { type: "next" },
    }),
  }));
}

function buildRequest(pathname: string, headers: Record<string, string> = {}): NextRequest {
  const url = `https://hearth.test${pathname}`;
  return {
    nextUrl: { pathname },
    url,
    cookies: { getAll: () => [] },
    headers: {
      get: (k: string) => headers[k.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

describe("middleware", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/supabase/middleware");
    delete process.env.CRON_SECRET;
  });

  it("unauthed user on gated route redirects to /auth/login with redirect param", async () => {
    setupMiddlewareMocks({ user: null, profile: null });
    const { middleware } = await import("@/middleware");
    const res = await middleware(buildRequest("/opportunities"));

    expect(res?.status).toBe(307);
    const location = res?.headers.get("location");
    expect(location).toContain("/auth/login");
    expect(location).toContain("redirect=%2Fopportunities");
  });

  it("authed but pending profile redirects to /auth/pending", async () => {
    setupMiddlewareMocks({
      user: { id: "u-1" },
      profile: { status: "pending", is_admin: false },
    });
    const { middleware } = await import("@/middleware");
    const res = await middleware(buildRequest("/opportunities"));

    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("/auth/pending");
  });

  it("approved non-admin on /admin/* gets bounced to /dashboard", async () => {
    setupMiddlewareMocks({
      user: { id: "u-1" },
      profile: { status: "approved", is_admin: false },
    });
    const { middleware } = await import("@/middleware");
    const res = await middleware(buildRequest("/admin/members"));

    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("/dashboard");
  });

  it("/api/cron/* without Bearer CRON_SECRET returns 401", async () => {
    process.env.CRON_SECRET = "expected-secret";
    setupMiddlewareMocks({ user: null, profile: null });
    const { middleware } = await import("@/middleware");

    const noAuth = await middleware(buildRequest("/api/cron/ingest-slack"));
    expect(noAuth?.status).toBe(401);

    const wrongAuth = await middleware(
      buildRequest("/api/cron/ingest-slack", { authorization: "Bearer wrong" }),
    );
    expect(wrongAuth?.status).toBe(401);

    const goodAuth = await middleware(
      buildRequest("/api/cron/ingest-slack", { authorization: "Bearer expected-secret" }),
    );
    expect(goodAuth?.status).not.toBe(401);
  });

  it("/api/cron/* with CRON_SECRET unset returns 401 and logs the misconfig", async () => {
    delete process.env.CRON_SECRET;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setupMiddlewareMocks({ user: null, profile: null });
    const { middleware } = await import("@/middleware");

    const res = await middleware(
      buildRequest("/api/cron/ingest-slack", { authorization: "Bearer anything" }),
    );
    expect(res?.status).toBe(401);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
