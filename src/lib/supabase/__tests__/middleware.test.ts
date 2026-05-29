import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

type CookieOptions = Record<string, unknown>;
type CookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (
    cookies: { name: string; value: string; options: CookieOptions }[],
  ) => void;
};

describe("createMiddlewareClient", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@supabase/ssr");
    vi.doUnmock("next/server");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("returns a supabase client + response and wires request/response cookie adapters", async () => {
    let captured: CookieAdapter | undefined;
    const createServerClient = vi.fn().mockImplementation((_url, _key, opts) => {
      captured = opts.cookies as CookieAdapter;
      return { id: "mw-client" };
    });
    const responseCookieSet = vi.fn();
    const nextResponse = { cookies: { set: responseCookieSet } };
    const nextFn = vi.fn().mockReturnValue(nextResponse);

    vi.doMock("@supabase/ssr", () => ({ createServerClient }));
    vi.doMock("next/server", () => ({
      NextResponse: { next: nextFn },
      NextRequest: class {},
    }));
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const requestCookieSet = vi.fn();
    const request = {
      cookies: {
        getAll: vi.fn(() => [{ name: "x", value: "1" }]),
        set: requestCookieSet,
      },
    } as unknown as NextRequest;

    const { createMiddlewareClient } = await import("@/lib/supabase/middleware");
    const { supabase, response } = createMiddlewareClient(request);

    expect(supabase).toEqual({ id: "mw-client" });
    expect(response).toBe(nextResponse);
    expect(nextFn).toHaveBeenCalledTimes(1);
    expect(captured?.getAll()).toEqual([{ name: "x", value: "1" }]);

    captured?.setAll([{ name: "a", value: "1", options: { path: "/" } }]);

    // setAll mirrors cookies onto the request, rebuilds the response, then sets them on it
    expect(requestCookieSet).toHaveBeenCalledWith("a", "1");
    expect(nextFn).toHaveBeenCalledTimes(2);
    expect(responseCookieSet).toHaveBeenCalledWith("a", "1", { path: "/" });
  });
});
