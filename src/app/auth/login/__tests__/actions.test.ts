import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// redirect() halts by throwing in Next.js; mirror that so the action stops.
class RedirectError extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

function setupMocks(opts: {
  rateLimitSuccess?: boolean;
  signInError?: { message: string } | null;
}) {
  const signInSpy = vi.fn().mockResolvedValue({ error: opts.signInError ?? null });
  const redirectSpy = vi.fn((url: string) => {
    throw new RedirectError(url);
  });

  vi.doMock("@/lib/rate-limit", () => ({
    rateLimit: vi.fn().mockResolvedValue({ success: opts.rateLimitSuccess ?? true, remaining: 0 }),
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
  fd.set("email", "user@test.com");
  fd.set("password", "secret123");
  return fd;
}

describe("login error messages (user enumeration)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/rate-limit");
    vi.doUnmock("@/lib/supabase/server");
    vi.doUnmock("next/navigation");
    vi.doUnmock("next/headers");
  });

  it("returns a generic error and never leaks the Supabase auth message", async () => {
    const { redirectSpy } = setupMocks({ signInError: { message: "Email not confirmed" } });
    const { login } = await import("@/app/auth/login/actions");

    await expect(login(makeFormData())).rejects.toThrow(/NEXT_REDIRECT/);

    expect(redirectSpy).toHaveBeenCalledWith("/auth/login?error=Invalid email or password");
    const urls = redirectSpy.mock.calls.map((c) => c[0]);
    expect(urls.some((u) => /Email not confirmed/.test(u))).toBe(false);
  });

  it("redirects to the requested path on successful sign-in", async () => {
    const { redirectSpy } = setupMocks({ signInError: null });
    const { login } = await import("@/app/auth/login/actions");

    const fd = makeFormData();
    fd.set("redirect", "/dashboard");
    await expect(login(fd)).rejects.toThrow(/NEXT_REDIRECT/);

    expect(redirectSpy).toHaveBeenCalledWith("/dashboard");
  });
});
