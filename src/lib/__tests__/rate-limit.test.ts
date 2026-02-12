import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('allows the first request', async () => {
    const { rateLimit } = await import('../rate-limit');
    const result = rateLimit('first-req', { interval: 60000, maxRequests: 5 });
    expect(result.success).toBe(true);
    expect(result.retryAfter).toBe(0);
  });

  it('allows multiple requests within the limit', async () => {
    const { rateLimit } = await import('../rate-limit');
    const config = { interval: 60000, maxRequests: 3 };

    const r1 = rateLimit('multi-key', config);
    const r2 = rateLimit('multi-key', config);
    const r3 = rateLimit('multi-key', config);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(true);
  });

  it('rejects requests exceeding maxRequests', async () => {
    const { rateLimit } = await import('../rate-limit');
    const config = { interval: 60000, maxRequests: 2 };

    rateLimit('exceed-key', config);
    rateLimit('exceed-key', config);
    const r3 = rateLimit('exceed-key', config);

    expect(r3.success).toBe(false);
    expect(r3.retryAfter).toBeGreaterThan(0);
  });

  it('returns retryAfter in seconds', async () => {
    const { rateLimit } = await import('../rate-limit');
    const config = { interval: 60000, maxRequests: 1 };

    rateLimit('retry-key', config);

    // Advance 10 seconds
    vi.advanceTimersByTime(10000);

    const result = rateLimit('retry-key', config);
    expect(result.success).toBe(false);
    // Should be ~50 seconds remaining (60 - 10)
    expect(result.retryAfter).toBe(50);
  });

  it('tracks different keys independently', async () => {
    const { rateLimit } = await import('../rate-limit');
    const config = { interval: 60000, maxRequests: 1 };

    rateLimit('key-a', config);
    const resultA = rateLimit('key-a', config);
    const resultB = rateLimit('key-b', config);

    expect(resultA.success).toBe(false);
    expect(resultB.success).toBe(true);
  });

  it('resets after window expires', async () => {
    const { rateLimit } = await import('../rate-limit');
    const config = { interval: 10000, maxRequests: 1 };

    rateLimit('reset-key', config);
    const blocked = rateLimit('reset-key', config);
    expect(blocked.success).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(11000);

    const afterReset = rateLimit('reset-key', config);
    expect(afterReset.success).toBe(true);
    expect(afterReset.retryAfter).toBe(0);
  });

  it('handles single-request limit correctly', async () => {
    const { rateLimit } = await import('../rate-limit');
    const config = { interval: 5000, maxRequests: 1 };

    const first = rateLimit('single-key', config);
    expect(first.success).toBe(true);

    const second = rateLimit('single-key', config);
    expect(second.success).toBe(false);
  });
});
