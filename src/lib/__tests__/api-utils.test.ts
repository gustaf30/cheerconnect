import { describe, it, expect, vi } from "vitest";

// Mock dependências que requerem DATABASE_URL
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { parsePaginationLimit } from "../api-utils";

describe("parsePaginationLimit", () => {
  function params(obj: Record<string, string> = {}) {
    return new URLSearchParams(obj);
  }

  it("retorna default quando limit não está presente", () => {
    expect(parsePaginationLimit(params())).toBe(20);
  });

  it("retorna default customizado quando passado", () => {
    expect(parsePaginationLimit(params(), 10)).toBe(10);
  });

  it("parseia limit dos searchParams", () => {
    expect(parsePaginationLimit(params({ limit: "5" }))).toBe(5);
  });

  it("limita ao maxLimit", () => {
    expect(parsePaginationLimit(params({ limit: "200" }))).toBe(50);
  });

  it("limita ao maxLimit customizado", () => {
    expect(parsePaginationLimit(params({ limit: "200" }), 50, 100)).toBe(100);
  });

  it("usa default para valor inválido (NaN)", () => {
    expect(parsePaginationLimit(params({ limit: "abc" }))).toBe(20);
  });

  it("usa default para zero", () => {
    expect(parsePaginationLimit(params({ limit: "0" }))).toBe(20);
  });

  it("usa default para negativo", () => {
    expect(parsePaginationLimit(params({ limit: "-5" }))).toBe(20);
  });
});
