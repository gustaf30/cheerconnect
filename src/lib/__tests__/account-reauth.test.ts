import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const model = {
    deleteMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  };
  return {
    mockPrisma: {
      accountReauthChallenge: model,
      $transaction: vi.fn(),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  consumeAccountDeletionChallenge,
  createAccountDeletionChallenge,
  hasValidAccountDeletionChallenge,
  verifyAccountDeletionChallenge,
} from "../account-reauth";

describe("account reauthentication challenges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma));
  });

  it("stores only a hash and returns a one-time token", async () => {
    mockPrisma.accountReauthChallenge.create.mockResolvedValue({
      id: "challenge-1",
      expiresAt: new Date("2026-01-01T00:10:00.000Z"),
    });

    const result = await createAccountDeletionChallenge("user-1", 3);

    expect(result.id).toBe("challenge-1");
    expect(result.token).toEqual(expect.any(String));
    expect(result.token.length).toBeGreaterThan(30);
    const stored = mockPrisma.accountReauthChallenge.create.mock.calls[0][0].data;
    expect(stored.tokenHash).not.toBe(result.token);
    expect(stored.userId).toBe("user-1");
    expect(stored.tokenVersion).toBe(3);
    expect(stored.purpose).toBe("ACCOUNT_DELETION");
  });

  it("rejects an expired challenge", async () => {
    mockPrisma.accountReauthChallenge.findUnique.mockResolvedValue({
      id: "challenge-1",
      userId: "user-1",
      purpose: "ACCOUNT_DELETION",
      tokenVersion: 3,
      expiresAt: new Date(Date.now() - 1000),
      verifiedAt: null,
      consumedAt: null,
      attempts: 0,
    });

    const result = await verifyAccountDeletionChallenge("user-1", "token", 3);

    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a challenge belonging to another user", async () => {
    mockPrisma.accountReauthChallenge.findUnique.mockResolvedValue({
      id: "challenge-1",
      userId: "user-2",
      purpose: "ACCOUNT_DELETION",
      tokenVersion: 3,
      expiresAt: new Date(Date.now() + 60_000),
      verifiedAt: null,
      consumedAt: null,
      attempts: 0,
    });

    const result = await verifyAccountDeletionChallenge("user-1", "token", 3);

    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("recognizes a verified challenge for the current session version", async () => {
    mockPrisma.accountReauthChallenge.count.mockResolvedValue(1);

    await expect(
      hasValidAccountDeletionChallenge("user-1", "challenge-1", 3)
    ).resolves.toBe(true);
  });

  it("consumes only a verified, unconsumed challenge", async () => {
    mockPrisma.accountReauthChallenge.updateMany.mockResolvedValue({ count: 1 });

    const result = await consumeAccountDeletionChallenge(
      mockPrisma as never,
      "user-1",
      "challenge-1",
      3
    );

    expect(result).toBe(true);
    expect(mockPrisma.accountReauthChallenge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "challenge-1",
          userId: "user-1",
          consumedAt: null,
        }),
      })
    );
  });
});
