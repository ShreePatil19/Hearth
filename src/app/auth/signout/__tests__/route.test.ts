import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

describe("auth/signout POST", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/supabase/server");
  });

  it("signs the user out and redirects to the home page", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({ auth: { signOut } }),
    }));

    const { POST } = await import("@/app/auth/signout/route");
    const request = { url: "https://hearth.test/auth/signout" } as unknown as NextRequest;

    const res = await POST(request);

    expect(signOut).toHaveBeenCalledOnce();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://hearth.test/");
  });
});
