/**
 * In-memory sliding window rate limiter.
 * Usable in Node.js API route handlers (NOT Edge middleware — see middleware.ts for Edge version).
 */

type RateLimitConfig = {
  interval: number; // ms
  maxRequests: number;
};

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60_000);

export function rateLimit(
  key: string,
  config: RateLimitConfig
): { success: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + config.interval });
    return { success: true, retryAfter: 0 };
  }

  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { success: false, retryAfter };
  }

  entry.count++;
  return { success: true, retryAfter: 0 };
}
