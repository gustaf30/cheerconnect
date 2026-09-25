// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { mockPrisma, mockRequireAuth, mockHasValid, mockConsume } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    privacyRequest: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  mockRequireAuth: vi.fn(),
  mockHasValid: vi.fn(),
  mockConsume: vi.fn(),
}));

vi.mock("@/lib/api-utils", () => ({
  requireAuth: mockRequireAuth,
  handleZodError: () => null,
  internalError: () => NextResponse.json({ error: "internal" }, { status: 500 }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/account-reauth", () => ({
  hasValidAccountDeletionChallenge: mockHasValid,
  consumeAccountDeletionChallenge: mockConsume,
}));

import { POST } from "@/app/api/privacy/request/route";

const request = (body: Record<string, string>) =>
  new Request("http://localhost:3000/api/privacy/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/privacy/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      session: { user: { id: "user-1", tokenVersion: 2 } },
      error: null,
    });
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma));
  });

  it("does not allow asynchronous deletion without a verified email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "user",
      emailVerified: null,
      tokenVersion: 2,
    });

    const response = await POST(
      request({ type: "DELETE", username: "user", reauthChallengeId: "challenge-1" })
    );

    expect(response.status).toBe(403);
    expect(mockPrisma.privacyRequest.create).not.toHaveBeenCalled();
  });

  it("stores a verified deletion request only after consuming the challenge", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "user",
      emailVerified: new Date(),
      tokenVersion: 2,
    });
    mockHasValid.mockResolvedValue(true);
    mockConsume.mockResolvedValue(true);
    mockPrisma.privacyRequest.create.mockResolvedValue({ id: "privacy-1" });

    const response = await POST(
      request({ type: "DELETE", username: "user", reauthChallengeId: "challenge-1" })
    );

    expect(response.status).toBe(201);
    expect(mockConsume).toHaveBeenCalledWith(expect.anything(), "user-1", "challenge-1", 2);
    expect(mockPrisma.privacyRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reauthVerifiedAt: expect.any(Date) }),
      })
    );
  });
});
