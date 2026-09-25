import { describe, expect, it } from "vitest";
import { assertDateOrder, canonicalPairKey, dateStringSchema, externalHttpUrlSchema } from "@/lib/validation";

describe("input validation", () => {
  it("accepts only HTTP and HTTPS external URLs", () => {
    expect(externalHttpUrlSchema.safeParse("https://example.com").success).toBe(true);
    expect(externalHttpUrlSchema.safeParse("http://example.com").success).toBe(true);
    expect(externalHttpUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(externalHttpUrlSchema.safeParse("file:///tmp/a").success).toBe(false);
  });

  it("rejects invalid dates", () => {
    expect(dateStringSchema.safeParse("not-a-date").success).toBe(false);
    expect(dateStringSchema.safeParse("2026-02-31").success).toBe(false);
    expect(dateStringSchema.safeParse("2026-09-24T10:00:00").success).toBe(false);
    expect(dateStringSchema.parse("2026-09-24T10:00:00.000Z")).toBeInstanceOf(Date);
  });

  it("rejects an end date before the start date", () => {
    expect(() => assertDateOrder(new Date("2026-09-25"), new Date("2026-09-24"))).toThrow();
    expect(() => assertDateOrder(new Date("2026-09-24"), new Date("2026-09-25"))).not.toThrow();
  });

  it("builds a stable key independent of participant order", () => {
    expect(canonicalPairKey("b", "a")).toBe(canonicalPairKey("a", "b"));
  });
});
