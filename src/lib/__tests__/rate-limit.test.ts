import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ratelimit } from "@upstash/ratelimit";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("allows the request and returns a high remaining when no limiter is configured", async () => {
    const result = await rateLimit("user-1", null);
    expect(result).toEqual({ success: true, remaining: 999 });
  });

  it("delegates to the provided limiter and returns its verdict", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false, remaining: 0 });
    const fake = { limit } as unknown as Ratelimit;

    const result = await rateLimit("user-1", fake);

    expect(limit).toHaveBeenCalledWith("user-1");
    expect(result).toEqual({ success: false, remaining: 0 });
  });

  it("passes through a successful limiter verdict", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true, remaining: 4 });
    const fake = { limit } as unknown as Ratelimit;

    const result = await rateLimit("user-2", fake);

    expect(result).toEqual({ success: true, remaining: 4 });
  });
});

describe("rate-limit module initialisation", () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    vi.resetModules();
  });

  it("leaves limiters null when Upstash env vars are absent", async () => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const mod = await import("@/lib/rate-limit");
    expect(mod.authLimiter).toBeNull();
    expect(mod.apiLimiter).toBeNull();
  });

  it("constructs limiters when Upstash env vars are present", async () => {
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    const mod = await import("@/lib/rate-limit");
    expect(mod.authLimiter).not.toBeNull();
    expect(mod.apiLimiter).not.toBeNull();
  });
});
