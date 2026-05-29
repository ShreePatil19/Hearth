import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("createClient (browser)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@supabase/ssr");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("creates a browser client from the public URL and anon key", async () => {
    const sentinel = { id: "browser-client" };
    const createBrowserClient = vi.fn().mockReturnValue(sentinel);
    vi.doMock("@supabase/ssr", () => ({ createBrowserClient }));
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const { createClient } = await import("@/lib/supabase/client");
    const result = createClient();

    expect(result).toBe(sentinel);
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "anon-key",
    );
  });
});
