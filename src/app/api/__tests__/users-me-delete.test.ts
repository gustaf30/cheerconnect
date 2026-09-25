// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { mockPrisma, mockRequireAuth, mockDeleteMedia, mockHasValid, mockConsume } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    teamMember: { findMany: vi.fn() },
    activityLog: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
  mockRequireAuth: vi.fn(),
  mockDeleteMedia: vi.fn(),
  mockHasValid: vi.fn(),
  mockConsume: vi.fn(),
}));

vi.mock("@/lib/api-utils", () => ({
  requireAuth: mockRequireAuth,
  handleZodError: () => null,
  internalError: () => NextResponse.json({ error: "internal" }, { status: 500 }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/media-assets", () => ({ deleteUserMediaAssets: mockDeleteMedia }));
vi.mock("@/lib/account-reauth", () => ({
  hasValidAccountDeletionChallenge: mockHasValid,
  consumeAccountDeletionChallenge: mockConsume,
}));

import { DELETE } from "@/app/api/users/me/route";

const request = (body: Record<string, string>) =>
  new Request("http://localhost:3000/api/users/me", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("DELETE /api/users/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      session: { user: { id: "user-1", tokenVersion: 2 } },
      error: null,
    });
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma));
    mockPrisma.teamMember.findMany.mockResolvedValue([]);
    mockPrisma.activityLog.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.delete.mockResolvedValue({});
  });

  it("rejects an unverified account before touching media", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "user",
      emailVerified: null,
      tokenVersion: 2,
    });

    const response = await DELETE(request({ username: "user", reauthChallengeId: "challenge-1" }));

    expect(response.status).toBe(403);
    expect(mockHasValid).not.toHaveBeenCalled();
    expect(mockDeleteMedia).not.toHaveBeenCalled();
  });

  it("rejects an invalid or expired reauthentication challenge", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "user",
      emailVerified: new Date(),
      tokenVersion: 2,
    });
    mockHasValid.mockResolvedValue(false);

    const response = await DELETE(request({ username: "user", reauthChallengeId: "challenge-1" }));

    expect(response.status).toBe(403);
    expect(mockDeleteMedia).not.toHaveBeenCalled();
    expect(mockConsume).not.toHaveBeenCalled();
  });

  it("deletes only after a valid challenge and username", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "user",
      emailVerified: new Date(),
      tokenVersion: 2,
    });
    mockHasValid.mockResolvedValue(true);
    mockConsume.mockResolvedValue(true);

    const response = await DELETE(request({ username: "user", reauthChallengeId: "challenge-1" }));

    expect(response.status).toBe(200);
    expect(mockConsume).toHaveBeenCalledWith(expect.anything(), "user-1", "challenge-1", 2);
    expect(mockDeleteMedia).toHaveBeenCalledWith("user-1");
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
  });
});
