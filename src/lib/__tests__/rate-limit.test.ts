import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it("allows the first request", async () => {
    const { rateLimit } = await import("../rate-limit");
    const result = rateLimit("first-req", 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("allows multiple requests within the limit", async () => {
    const { rateLimit } = await import("../rate-limit");

    const r1 = rateLimit("multi-key", 3, 60000);
    const r2 = rateLimit("multi-key", 3, 60000);
    const r3 = rateLimit("multi-key", 3, 60000);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
  });

  it("rejects requests exceeding limit", async () => {
    const { rateLimit } = await import("../rate-limit");

    rateLimit("exceed-key", 2, 60000);
    rateLimit("exceed-key", 2, 60000);
    const r3 = rateLimit("exceed-key", 2, 60000);

    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.resetMs).toBeGreaterThan(0);
  });

  it("returns resetMs for blocked requests", async () => {
    const { rateLimit } = await import("../rate-limit");

    rateLimit("retry-key", 1, 60000);

    vi.advanceTimersByTime(10000);

    const result = rateLimit("retry-key", 1, 60000);
    expect(result.allowed).toBe(false);
    // resetMs should be ~50000ms (60000 - 10000)
    expect(result.resetMs).toBeGreaterThanOrEqual(49000);
    expect(result.resetMs).toBeLessThanOrEqual(51000);
  });

  it("tracks different keys independently", async () => {
    const { rateLimit } = await import("../rate-limit");

    rateLimit("key-a", 1, 60000);
    const resultA = rateLimit("key-a", 1, 60000);
    const resultB = rateLimit("key-b", 1, 60000);

    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });

  it("resets after window expires", async () => {
    const { rateLimit } = await import("../rate-limit");

    rateLimit("reset-key", 1, 10000);
    const blocked = rateLimit("reset-key", 1, 10000);
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(11000);

    const afterReset = rateLimit("reset-key", 1, 10000);
    expect(afterReset.allowed).toBe(true);
  });

  it("handles single-request limit correctly", async () => {
    const { rateLimit } = await import("../rate-limit");

    const first = rateLimit("single-key", 1, 5000);
    expect(first.allowed).toBe(true);

    const second = rateLimit("single-key", 1, 5000);
    expect(second.allowed).toBe(false);
  });
});
