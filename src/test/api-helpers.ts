import { vi } from "vitest";
import { NextRequest } from "next/server";

// Mock NextAuth session
export function mockSession(overrides?: Partial<{
  user: { id: string; name: string; email: string; username: string };
  expires: string;
}>) {
  return {
    user: {
      id: "test-user-id",
      name: "Test User",
      email: "test@example.com",
      username: "testuser",
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

// Create a NextRequest for testing
export function createRequest(
  method: string,
  url: string,
  body?: Record<string, unknown>
) {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init as RequestInit & { signal?: AbortSignal });
}

// Create mock prisma client — call this per-test-file and add methods as needed
export function createMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    connection: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    teamMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    teamFollow: {
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    tag: {
      upsert: vi.fn(),
    },
    postTag: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    mention: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    block: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({
      user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
      post: { create: vi.fn(), findMany: vi.fn() },
      connection: { create: vi.fn(), findFirst: vi.fn() },
      team: { create: vi.fn(), findFirst: vi.fn() },
      teamMember: { create: vi.fn() },
      notification: { create: vi.fn() },
      tag: { upsert: vi.fn() },
      postTag: { create: vi.fn(), deleteMany: vi.fn() },
      mention: { create: vi.fn(), deleteMany: vi.fn() },
    })),
  };
}
