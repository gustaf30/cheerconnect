// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { user: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn() } }));

import { isSessionTokenValid } from "../api-utils";

describe("session validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a session whose email is not verified", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 2, emailVerified: null });

    await expect(isSessionTokenValid("user-1", 2)).resolves.toBe(false);
  });

  it("accepts a verified session with the current token version", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 2, emailVerified: new Date() });

    await expect(isSessionTokenValid("user-1", 2)).resolves.toBe(true);
  });
});
