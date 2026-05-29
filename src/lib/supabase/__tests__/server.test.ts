import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CookieOptions = Record<string, unknown>;
type CookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (
    cookies: { name: string; value: string; options: CookieOptions }[],
  ) => void;
};

describe("createClient (server)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@supabase/ssr");
    vi.doUnmock("next/headers");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("awaits the cookie store and wires getAll/setAll into the server client", async () => {
    const getAll = vi.fn().mockReturnValue([{ name: "sb", value: "v" }]);
    const set = vi.fn();
    let captured: CookieAdapter | undefined;
    const createServerClient = vi.fn().mockImplementation((_url, _key, opts) => {
      captured = opts.cookies as CookieAdapter;
      return { id: "server-client" };
    });

    vi.doMock("@supabase/ssr", () => ({ createServerClient }));
    vi.doMock("next/headers", () => ({
      cookies: vi.fn().mockResolvedValue({ getAll, set }),
    }));
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const { createClient } = await import("@/lib/supabase/server");
    const client = await createClient();

    expect(client).toEqual({ id: "server-client" });
    expect(createServerClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "anon-key",
      expect.objectContaining({ cookies: expect.any(Object) }),
    );

    expect(captured?.getAll()).toEqual([{ name: "sb", value: "v" }]);

    captured?.setAll([{ name: "a", value: "1", options: { path: "/" } }]);
    expect(set).toHaveBeenCalledWith("a", "1", { path: "/" });
  });

  it("swallows cookie write errors thrown during setAll", async () => {
    const set = vi.fn(() => {
      throw new Error("cookies are read-only in this context");
    });
    let captured: CookieAdapter | undefined;

    vi.doMock("@supabase/ssr", () => ({
      createServerClient: (_url: string, _key: string, opts: { cookies: CookieAdapter }) => {
        captured = opts.cookies;
        return {};
      },
    }));
    vi.doMock("next/headers", () => ({
      cookies: vi.fn().mockResolvedValue({ getAll: vi.fn(() => []), set }),
    }));

    const { createClient } = await import("@/lib/supabase/server");
    await createClient();

    expect(() =>
      captured?.setAll([{ name: "a", value: "1", options: {} }]),
    ).not.toThrow();
    expect(set).toHaveBeenCalled();
  });
});
