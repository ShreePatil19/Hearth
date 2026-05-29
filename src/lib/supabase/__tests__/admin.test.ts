import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("createAdminClient", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@supabase/supabase-js");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("creates a service-role client with token refresh and session persistence disabled", async () => {
    const sentinel = { id: "admin-client" };
    const createClient = vi.fn().mockReturnValue(sentinel);
    vi.doMock("@supabase/supabase-js", () => ({ createClient }));
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const result = createAdminClient();

    expect(result).toBe(sentinel);
    expect(createClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "service-role-key",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  });
});
