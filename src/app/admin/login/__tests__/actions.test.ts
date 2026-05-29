import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// redirect() in Next.js halts execution by throwing. Mirror that so the action
// stops at the gate instead of falling through to the credential check.
class RedirectError extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

function setupMocks(opts: {
  rateLimitSuccess: boolean;
  signInError?: { message: string } | null;
}) {
  const signInSpy = vi.fn().mockResolvedValue({ error: opts.signInError ?? null });
  const redirectSpy = vi.fn((url: string) => {
    throw new RedirectError(url);
  });

  vi.doMock("@/lib/rate-limit", () => ({
    rateLimit: vi.fn().mockResolvedValue({ success: opts.rateLimitSuccess, remaining: 0 }),
    authLimiter: {},
  }));
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
      auth: { signInWithPassword: signInSpy },
    }),
  }));
  vi.doMock("next/navigation", () => ({ redirect: redirectSpy }));
  vi.doMock("next/headers", () => ({
    headers: vi.fn().mockResolvedValue({
      get: (k: string) => (k.toLowerCase() === "x-forwarded-for" ? "1.2.3.4" : null),
    }),
  }));

  return { signInSpy, redirectSpy };
}

function makeFormData(): FormData {
  const fd = new FormData();
  fd.set("email", "admin@test.com");
  fd.set("password", "secret123");
  return fd;
}

describe("adminLogin rate limiting", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/rate-limit");
    vi.doUnmock("@/lib/supabase/server");
    vi.doUnmock("next/navigation");
    vi.doUnmock("next/headers");
  });

  it("blocks the credential check when the rate limit is exceeded", async () => {
    const { signInSpy, redirectSpy } = setupMocks({ rateLimitSuccess: false });
    const { adminLogin } = await import("@/app/admin/login/actions");

    await expect(adminLogin(makeFormData())).rejects.toThrow(/NEXT_REDIRECT/);

    expect(redirectSpy).toHaveBeenCalledWith(
      expect.stringContaining("Too many login attempts"),
    );
    expect(signInSpy).not.toHaveBeenCalled();
  });

  it("proceeds to authenticate when under the rate limit", async () => {
    const { signInSpy, redirectSpy } = setupMocks({ rateLimitSuccess: true });
    const { adminLogin } = await import("@/app/admin/login/actions");

    await expect(adminLogin(makeFormData())).rejects.toThrow(/NEXT_REDIRECT/);

    expect(signInSpy).toHaveBeenCalledWith({
      email: "admin@test.com",
      password: "secret123",
    });
    expect(redirectSpy).toHaveBeenCalledWith("/admin");
  });

  it("returns a generic error and never leaks the Supabase auth message", async () => {
    const { redirectSpy } = setupMocks({
      rateLimitSuccess: true,
      signInError: { message: "Invalid login credentials" },
    });
    const { adminLogin } = await import("@/app/admin/login/actions");

    await expect(adminLogin(makeFormData())).rejects.toThrow(/NEXT_REDIRECT/);

    expect(redirectSpy).toHaveBeenCalledWith("/admin/login?error=Invalid email or password");
    const urls = redirectSpy.mock.calls.map((c) => c[0]);
    expect(urls.some((u) => /Invalid login credentials/.test(u))).toBe(false);
  });
});
