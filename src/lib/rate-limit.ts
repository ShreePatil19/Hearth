/**
 * Simple in-memory rate limiter for API routes.
 * Tracks requests per IP with a sliding window.
 */

const requests = new Map<string, { count: number; resetAt: number }>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const keys = Array.from(requests.keys());
  for (const key of keys) {
    const val = requests.get(key);
    if (val && val.resetAt < now) requests.delete(key);
  }
}, 5 * 60 * 1000);

export function rateLimit(
  ip: string,
  { limit = 10, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): { success: boolean; remaining: number } {
  const now = Date.now();
  const key = ip;
  const existing = requests.get(key);

  if (!existing || existing.resetAt < now) {
    requests.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    return { success: false, remaining: 0 };
  }

  existing.count++;
  return { success: true, remaining: limit - existing.count };
}
