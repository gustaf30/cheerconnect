import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ACCOUNT_REAUTH_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const PURPOSE = "ACCOUNT_DELETION" as const;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAccountDeletionChallenge(userId: string, tokenVersion: number) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ACCOUNT_REAUTH_TTL_MS);

  return prisma.$transaction(async (tx) => {
    await tx.accountReauthChallenge.deleteMany({
      where: { userId, purpose: PURPOSE, consumedAt: null },
    });
    const challenge = await tx.accountReauthChallenge.create({
      data: {
        userId,
        purpose: PURPOSE,
        tokenHash,
        tokenVersion,
        expiresAt,
      },
      select: { id: true, expiresAt: true },
    });
    return { ...challenge, token };
  });
}

export type ReauthVerificationResult =
  | { ok: true; challengeId: string }
  | { ok: false; reason: "invalid" | "expired" | "consumed" | "locked" };

export async function verifyAccountDeletionChallenge(
  userId: string,
  token: string,
  tokenVersion: number
): Promise<ReauthVerificationResult> {
  const challenge = await prisma.accountReauthChallenge.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      userId: true,
      purpose: true,
      tokenVersion: true,
      expiresAt: true,
      verifiedAt: true,
      consumedAt: true,
      attempts: true,
    },
  });

  if (
    !challenge ||
    challenge.userId !== userId ||
    challenge.purpose !== PURPOSE ||
    challenge.tokenVersion !== tokenVersion
  ) {
    return { ok: false, reason: "invalid" };
  }
  if (challenge.consumedAt) return { ok: false, reason: "consumed" };
  if (challenge.expiresAt <= new Date()) return { ok: false, reason: "expired" };
  if (challenge.attempts >= MAX_VERIFY_ATTEMPTS) return { ok: false, reason: "locked" };
  if (challenge.verifiedAt) return { ok: true, challengeId: challenge.id };

  const now = new Date();
  const updated = await prisma.accountReauthChallenge.updateMany({
    where: {
      id: challenge.id,
      userId,
      purpose: PURPOSE,
      tokenVersion,
      verifiedAt: null,
      consumedAt: null,
      expiresAt: { gt: now },
      attempts: { lt: MAX_VERIFY_ATTEMPTS },
    },
    data: { verifiedAt: now, attempts: { increment: 1 } },
  });

  return updated.count === 1
    ? { ok: true, challengeId: challenge.id }
    : { ok: false, reason: "invalid" };
}

export async function hasValidAccountDeletionChallenge(
  userId: string,
  challengeId: string,
  tokenVersion: number
) {
  const count = await prisma.accountReauthChallenge.count({
    where: {
      id: challengeId,
      userId,
      purpose: PURPOSE,
      tokenVersion,
      verifiedAt: { not: null },
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  return count === 1;
}

export async function consumeAccountDeletionChallenge(
  tx: Pick<Prisma.TransactionClient, "accountReauthChallenge">,
  userId: string,
  challengeId: string,
  tokenVersion: number
) {
  const result = await tx.accountReauthChallenge.updateMany({
    where: {
      id: challengeId,
      userId,
      purpose: PURPOSE,
      tokenVersion,
      verifiedAt: { not: null },
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  });
  return result.count === 1;
}
