import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryRateLimiter, getClientIdentifier, getRateLimitRule } from "@/lib/middleware-policy";

describe("middleware in-memory limiter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allows requests up to the configured limit and rejects the next one", () => {
    const limiter = createInMemoryRateLimiter();
    const rule = { maxRequests: 2, interval: 60_000 };
    expect(limiter.check("key", rule)).toEqual({ success: true, retryAfter: 0 });
    expect(limiter.check("key", rule)).toEqual({ success: true, retryAfter: 0 });
    expect(limiter.check("key", rule).success).toBe(false);
  });

  it("resets an entry after its interval", () => {
    const limiter = createInMemoryRateLimiter();
    const rule = { maxRequests: 1, interval: 10_000 };
    expect(limiter.check("key", rule).success).toBe(true);
    expect(limiter.check("key", rule).success).toBe(false);
    vi.advanceTimersByTime(10_001);
    expect(limiter.check("key", rule).success).toBe(true);
  });

  it("calculates retry-after in seconds and cleans expired entries", () => {
    const limiter = createInMemoryRateLimiter();
    const rule = { maxRequests: 1, interval: 60_000 };
    limiter.check("key", rule);
    vi.advanceTimersByTime(20_000);
    expect(limiter.check("key", rule).retryAfter).toBe(40);
    vi.advanceTimersByTime(41_000);
    limiter.cleanup();
    expect(limiter.entries.has("key")).toBe(false);
  });
});

describe("middleware request policy", () => {
  it("selects rules for message, reauthentication and deletion requests", () => {
    expect(getRateLimitRule("/api/conversations/abc/messages", "POST")).toEqual({ maxRequests: 30, interval: 60_000 });
    expect(getRateLimitRule("/api/conversations/abc/messages", "GET")).toBeNull();
    expect(getRateLimitRule("/api/users/me/reauthenticate", "POST")).toEqual({ maxRequests: 3, interval: 60_000 });
    expect(getRateLimitRule("/api/users/me/reauthenticate/verify", "GET")).toEqual({ maxRequests: 10, interval: 60_000 });
    expect(getRateLimitRule("/api/users/me", "DELETE")).toEqual({ maxRequests: 3, interval: 60_000 });
  });

  it("uses the last forwarded address as the client identifier", () => {
    expect(getClientIdentifier(new Headers({ "x-forwarded-for": "10.0.0.1, 10.0.0.2" }))).toBe("10.0.0.2");
  });
});
