import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

/**
 * Tests for the middleware's internal rate limiting logic.
 *
 * The middleware (src/middleware.ts) has its own rate limiter that is separate
 * from src/lib/rate-limit.ts. The middleware uses a fixed-window approach with
 * a Map<string, {count, resetTime}>, while rate-limit.ts uses sliding window
 * with timestamps.
 *
 * Since the middleware functions are not exported, we replicate the pure logic
 * here for isolated unit testing.
 */

// --- Replicated pure functions from middleware.ts ---

type RateLimitRule = { maxRequests: number; interval: number };

function createRateLimiter() {
  const rateLimitMap = new Map<
    string,
    { count: number; resetTime: number }
  >();
  let lastCleanup = Date.now();

  function checkRateLimit(
    key: string,
    rule: RateLimitRule
  ): { success: boolean; retryAfter: number } {
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetTime) {
      rateLimitMap.set(key, { count: 1, resetTime: now + rule.interval });
      return { success: true, retryAfter: 0 };
    }

    if (entry.count >= rule.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      return { success: false, retryAfter };
    }

    entry.count++;
    return { success: true, retryAfter: 0 };
  }

  function cleanupRateLimitMap() {
    const now = Date.now();
    if (now - lastCleanup < 60_000) return;
    lastCleanup = now;
    for (const [key, value] of rateLimitMap) {
      if (now > value.resetTime) rateLimitMap.delete(key);
    }

    const MAX_RATE_LIMIT_ENTRIES = 10_000;
    if (rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
      const entriesToDelete = rateLimitMap.size - MAX_RATE_LIMIT_ENTRIES;
      let deleted = 0;
      for (const key of rateLimitMap.keys()) {
        if (deleted >= entriesToDelete) break;
        rateLimitMap.delete(key);
        deleted++;
      }
    }
  }

  return { checkRateLimit, cleanupRateLimitMap, rateLimitMap, getLastCleanup: () => lastCleanup };
}

function matchesConversationMessages(pathname: string): boolean {
  return /^\/api\/conversations\/[^/]+\/messages$/.test(pathname);
}

function getIp(request: { headers: Headers; ip?: string }): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.ip ||
    "anonymous"
  );
}

const RATE_LIMIT_RULES: { pattern: string; rule: RateLimitRule }[] = [
  { pattern: "/api/auth/register", rule: { maxRequests: 5, interval: 60_000 } },
  { pattern: "/api/posts", rule: { maxRequests: 10, interval: 60_000 } },
  { pattern: "/api/upload", rule: { maxRequests: 5, interval: 60_000 } },
];

// --- Tests ---

describe("Middleware Rate Limiting - checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request", () => {
    const { checkRateLimit } = createRateLimiter();
    const rule = { maxRequests: 5, interval: 60_000 };
    const result = checkRateLimit("test-key", rule);
    expect(result.success).toBe(true);
    expect(result.retryAfter).toBe(0);
  });

  it("allows requests up to the limit", () => {
    const { checkRateLimit } = createRateLimiter();
    const rule = { maxRequests: 3, interval: 60_000 };

    expect(checkRateLimit("key", rule).success).toBe(true); // 1
    expect(checkRateLimit("key", rule).success).toBe(true); // 2
    expect(checkRateLimit("key", rule).success).toBe(true); // 3
  });

  it("rejects requests exceeding the limit", () => {
    const { checkRateLimit } = createRateLimiter();
    const rule = { maxRequests: 2, interval: 60_000 };

    checkRateLimit("key", rule); // 1
    checkRateLimit("key", rule); // 2
    const result = checkRateLimit("key", rule); // 3 - should be rejected

    expect(result.success).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("returns correct retryAfter value in seconds", () => {
    const { checkRateLimit } = createRateLimiter();
    const rule = { maxRequests: 1, interval: 60_000 };

    checkRateLimit("key", rule); // 1 - allowed

    // Advance 20 seconds
    vi.advanceTimersByTime(20_000);

    const result = checkRateLimit("key", rule); // rejected
    expect(result.success).toBe(false);
    // retryAfter should be ~40 seconds (60 - 20)
    expect(result.retryAfter).toBe(40);
  });

  it("resets after the interval expires", () => {
    const { checkRateLimit } = createRateLimiter();
    const rule = { maxRequests: 1, interval: 10_000 };

    checkRateLimit("key", rule); // 1 - allowed
    expect(checkRateLimit("key", rule).success).toBe(false); // rejected

    // Advance past the interval
    vi.advanceTimersByTime(11_000);

    const result = checkRateLimit("key", rule);
    expect(result.success).toBe(true); // allowed again
  });

  it("tracks different keys independently", () => {
    const { checkRateLimit } = createRateLimiter();
    const rule = { maxRequests: 1, interval: 60_000 };

    checkRateLimit("key-a", rule); // a: 1
    const resultA = checkRateLimit("key-a", rule); // a: rejected
    const resultB = checkRateLimit("key-b", rule); // b: 1

    expect(resultA.success).toBe(false);
    expect(resultB.success).toBe(true);
  });

  it("counts correctly at the boundary", () => {
    const { checkRateLimit } = createRateLimiter();
    const rule = { maxRequests: 5, interval: 60_000 };

    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("key", rule).success).toBe(true);
    }
    // 6th request should fail
    expect(checkRateLimit("key", rule).success).toBe(false);
  });

  it("retryAfter is 0 for successful requests", () => {
    const { checkRateLimit } = createRateLimiter();
    const rule = { maxRequests: 10, interval: 60_000 };

    const result = checkRateLimit("key", rule);
    expect(result.retryAfter).toBe(0);
  });
});

describe("Middleware Rate Limiting - cleanupRateLimitMap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not cleanup if less than 60s since last cleanup", () => {
    const { checkRateLimit, cleanupRateLimitMap, rateLimitMap } =
      createRateLimiter();

    const rule = { maxRequests: 100, interval: 1_000 }; // 1 second window
    checkRateLimit("short-lived", rule);

    // Advance 2 seconds (entry expired) but less than 60s
    vi.advanceTimersByTime(2_000);
    cleanupRateLimitMap();

    // Entry should still be in the map because cleanup interval hasn't passed
    expect(rateLimitMap.has("short-lived")).toBe(true);
  });

  it("removes expired entries after 60s cleanup interval", () => {
    const { checkRateLimit, cleanupRateLimitMap, rateLimitMap } =
      createRateLimiter();

    const rule = { maxRequests: 100, interval: 1_000 }; // 1 second window
    checkRateLimit("expired-entry", rule);

    // Advance past both the entry's expiry and the cleanup interval
    vi.advanceTimersByTime(61_000);
    cleanupRateLimitMap();

    expect(rateLimitMap.has("expired-entry")).toBe(false);
  });

  it("keeps non-expired entries during cleanup", () => {
    const { checkRateLimit, cleanupRateLimitMap, rateLimitMap } =
      createRateLimiter();

    const shortRule = { maxRequests: 100, interval: 1_000 };
    const longRule = { maxRequests: 100, interval: 120_000 };

    checkRateLimit("short-lived", shortRule);
    checkRateLimit("long-lived", longRule);

    // Advance past cleanup interval but only short-lived entry expires
    vi.advanceTimersByTime(61_000);
    cleanupRateLimitMap();

    expect(rateLimitMap.has("short-lived")).toBe(false);
    expect(rateLimitMap.has("long-lived")).toBe(true);
  });
});

describe("Middleware Rate Limiting - matchesConversationMessages", () => {
  it("matches valid conversation message paths", () => {
    expect(matchesConversationMessages("/api/conversations/abc123/messages")).toBe(true);
    expect(matchesConversationMessages("/api/conversations/some-uuid/messages")).toBe(true);
    expect(matchesConversationMessages("/api/conversations/1/messages")).toBe(true);
  });

  it("does not match nested sub-paths", () => {
    expect(
      matchesConversationMessages("/api/conversations/abc/messages/read")
    ).toBe(false);
    expect(
      matchesConversationMessages("/api/conversations/abc/messages/123")
    ).toBe(false);
  });

  it("does not match parent paths", () => {
    expect(matchesConversationMessages("/api/conversations")).toBe(false);
    expect(matchesConversationMessages("/api/conversations/abc")).toBe(false);
  });

  it("does not match without conversation ID segment", () => {
    expect(matchesConversationMessages("/api/conversations//messages")).toBe(false);
  });

  it("does not match paths with slashes in the conversation ID", () => {
    expect(
      matchesConversationMessages("/api/conversations/a/b/messages")
    ).toBe(false);
  });

  it("does not match unrelated paths", () => {
    expect(matchesConversationMessages("/api/posts")).toBe(false);
    expect(matchesConversationMessages("/api/messages")).toBe(false);
    expect(matchesConversationMessages("/conversations/abc/messages")).toBe(false);
  });
});

describe("Middleware Rate Limiting - getIp", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const headers = new Headers({ "x-forwarded-for": "192.168.1.1" });
    expect(getIp({ headers })).toBe("192.168.1.1");
  });

  it("extracts first IP from comma-separated x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "10.0.0.1, 192.168.1.1, 172.16.0.1",
    });
    expect(getIp({ headers })).toBe("10.0.0.1");
  });

  it("trims whitespace from x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "  10.0.0.1  , 192.168.1.1",
    });
    expect(getIp({ headers })).toBe("10.0.0.1");
  });

  it("falls back to request.ip when no x-forwarded-for", () => {
    const headers = new Headers();
    expect(getIp({ headers, ip: "127.0.0.1" })).toBe("127.0.0.1");
  });

  it("returns 'anonymous' when neither header nor ip is available", () => {
    const headers = new Headers();
    expect(getIp({ headers })).toBe("anonymous");
  });

  it("returns 'anonymous' when ip is undefined and no header", () => {
    const headers = new Headers();
    expect(getIp({ headers, ip: undefined })).toBe("anonymous");
  });
});

describe("Middleware Rate Limiting - RATE_LIMIT_RULES config", () => {
  it("has rate limit for registration", () => {
    const rule = RATE_LIMIT_RULES.find(
      (r) => r.pattern === "/api/auth/register"
    );
    expect(rule).toBeDefined();
    expect(rule!.rule.maxRequests).toBe(5);
    expect(rule!.rule.interval).toBe(60_000);
  });

  it("has rate limit for posts", () => {
    const rule = RATE_LIMIT_RULES.find((r) => r.pattern === "/api/posts");
    expect(rule).toBeDefined();
    expect(rule!.rule.maxRequests).toBe(10);
    expect(rule!.rule.interval).toBe(60_000);
  });

  it("has rate limit for uploads", () => {
    const rule = RATE_LIMIT_RULES.find((r) => r.pattern === "/api/upload");
    expect(rule).toBeDefined();
    expect(rule!.rule.maxRequests).toBe(5);
    expect(rule!.rule.interval).toBe(60_000);
  });
});

describe("Middleware Rate Limiting - pattern matching logic", () => {
  // Replicate the route matching from the middleware function
  function findRule(pathname: string): RateLimitRule | null {
    if (matchesConversationMessages(pathname)) {
      return { maxRequests: 30, interval: 60_000 };
    }
    for (const r of RATE_LIMIT_RULES) {
      if (pathname === r.pattern || pathname.startsWith(r.pattern + "/")) {
        return r.rule;
      }
    }
    return null;
  }

  it("matches exact pattern paths", () => {
    expect(findRule("/api/posts")).not.toBeNull();
    expect(findRule("/api/upload")).not.toBeNull();
    expect(findRule("/api/auth/register")).not.toBeNull();
  });

  it("matches sub-paths of pattern", () => {
    expect(findRule("/api/posts/abc123")).not.toBeNull();
    expect(findRule("/api/posts/abc123/like")).not.toBeNull();
    expect(findRule("/api/upload/image")).not.toBeNull();
  });

  it("does not match partial prefix overlap", () => {
    // /api/postssomething should NOT match /api/posts
    expect(findRule("/api/postssomething")).toBeNull();
  });

  it("matches conversation messages with dynamic ID", () => {
    const rule = findRule("/api/conversations/abc123/messages");
    expect(rule).not.toBeNull();
    expect(rule!.maxRequests).toBe(30);
  });

  it("returns null for unmatched paths", () => {
    expect(findRule("/api/users")).toBeNull();
    expect(findRule("/api/teams")).toBeNull();
    expect(findRule("/feed")).toBeNull();
  });

  it("prioritizes conversation messages over static rules", () => {
    // Conversation messages pattern is checked first
    const rule = findRule("/api/conversations/xyz/messages");
    expect(rule).toEqual({ maxRequests: 30, interval: 60_000 });
  });
});
