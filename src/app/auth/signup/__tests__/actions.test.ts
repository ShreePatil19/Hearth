import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class RedirectError extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

function setupMocks(opts: { signUpError?: { message: string } | null }) {
  const signUpSpy = vi.fn().mockResolvedValue({ error: opts.signUpError ?? null });
  const redirectSpy = vi.fn((url: string) => {
    throw new RedirectError(url);
  });

  vi.doMock("@/lib/rate-limit", () => ({
    rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 0 }),
    authLimiter: {},
  }));
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
      auth: { signUp: signUpSpy },
    }),
  }));
  vi.doMock("next/navigation", () => ({ redirect: redirectSpy }));
  vi.doMock("next/headers", () => ({
    headers: vi.fn().mockResolvedValue({
      get: (k: string) => (k.toLowerCase() === "x-forwarded-for" ? "1.2.3.4" : null),
    }),
  }));

  return { signUpSpy, redirectSpy };
}

function makeFormData(): FormData {
  const fd = new FormData();
  fd.set("email", "new@test.com");
  fd.set("password", "password123");
  fd.set("confirmPassword", "password123");
  return fd;
}

describe("signup error messages (user enumeration)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/rate-limit");
    vi.doUnmock("@/lib/supabase/server");
    vi.doUnmock("next/navigation");
    vi.doUnmock("next/headers");
  });

  it("returns a generic error and never leaks 'already registered'", async () => {
    const { redirectSpy } = setupMocks({ signUpError: { message: "User already registered" } });
    const { signup } = await import("@/app/auth/signup/actions");

    await expect(signup(makeFormData())).rejects.toThrow(/NEXT_REDIRECT/);

    const urls = redirectSpy.mock.calls.map((c) => c[0]);
    expect(urls.some((u) => /already registered/i.test(u))).toBe(false);
    expect(redirectSpy).toHaveBeenCalledWith(
      expect.stringContaining("/auth/signup?error=Could not complete signup"),
    );
  });

  it("redirects to the email-confirmation message on success", async () => {
    const { redirectSpy } = setupMocks({ signUpError: null });
    const { signup } = await import("@/app/auth/signup/actions");

    await expect(signup(makeFormData())).rejects.toThrow(/NEXT_REDIRECT/);

    expect(redirectSpy).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login?message="),
    );
  });
});
