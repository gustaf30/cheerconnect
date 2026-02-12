/**
 * In-memory sliding window rate limiter.
 * Usable in Node.js API route handlers (NOT Edge middleware).
 */

const rateLimitMap = new Map<string, number[]>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const filtered = timestamps.filter((t) => t > now - 60000);
    if (filtered.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, filtered);
    }
  }
}, 60000);

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (rateLimitMap.get(key) || []).filter(
    (t) => t > windowStart
  );

  if (timestamps.length >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: timestamps[0] + windowMs - now,
    };
  }

  timestamps.push(now);
  rateLimitMap.set(key, timestamps);

  return {
    allowed: true,
    remaining: limit - timestamps.length,
    resetMs: windowMs,
  };
}

export function rateLimitHeaders(
  limit: number,
  remaining: number,
  resetMs: number
): Record<string, string> {
  return {
    "RateLimit-Limit": String(limit),
    "RateLimit-Remaining": String(remaining),
    "RateLimit-Reset": String(Math.ceil(resetMs / 1000)),
  };
}
