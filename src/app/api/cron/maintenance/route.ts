import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteCloudinaryAsset } from "@/lib/cloudinary";
import { backfillLegacyMediaAssets, deleteUserMediaAssets, reconcileCompletedMediaAssets } from "@/lib/media-assets";
import logger from "@/lib/logger";

const PRIVACY_PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;
const PRIVACY_MAX_ATTEMPTS = 5;

export async function processDeletePrivacyRequests() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - PRIVACY_PROCESSING_TIMEOUT_MS);
  const requests = await prisma.privacyRequest.findMany({
    where: {
      type: "DELETE",
      reauthVerifiedAt: { not: null },
      OR: [
        { status: "PENDING" },
        { status: "PROCESSING", processingStartedAt: { lt: staleBefore } },
        { status: "PROCESSING", processingStartedAt: null },
      ],
    },
    select: { id: true, userId: true, attempts: true },
    orderBy: { requestedAt: "asc" },
    take: 10,
  });
  let completed = 0;
  let rejected = 0;

  for (const privacyRequest of requests) {
    const claimed = await prisma.privacyRequest.updateMany({
      where: {
        id: privacyRequest.id,
        reauthVerifiedAt: { not: null },
        OR: [
          { status: "PENDING" },
          { status: "PROCESSING", processingStartedAt: { lt: staleBefore } },
          { status: "PROCESSING", processingStartedAt: null },
        ],
      },
      data: {
        status: "PROCESSING",
        processingStartedAt: now,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    if (claimed.count !== 1) continue;

    try {
      const adminMemberships = await prisma.teamMember.findMany({
        where: { userId: privacyRequest.userId, isActive: true, isAdmin: true },
        select: {
          team: {
            select: {
              members: {
                where: { isActive: true, isAdmin: true },
                select: { id: true },
              },
            },
          },
        },
      });
      if (adminMemberships.some(({ team }) => team.members.length <= 1)) {
        throw new Error("SOLE_ADMIN");
      }

      await deleteUserMediaAssets(privacyRequest.userId);
      await prisma.$transaction(async (tx) => {
        const currentAdminMemberships = await tx.teamMember.findMany({
          where: { userId: privacyRequest.userId, isActive: true, isAdmin: true },
          select: {
            team: {
              select: {
                members: {
                  where: { isActive: true, isAdmin: true },
                  select: { id: true },
                },
              },
            },
          },
        });
        if (currentAdminMemberships.some(({ team }) => team.members.length <= 1)) {
          throw new Error("SOLE_ADMIN");
        }
        await tx.activityLog.updateMany({
          where: { actorId: privacyRequest.userId },
          data: {
            actorId: null,
            metadata: Prisma.JsonNull,
            anonymizedAt: new Date(),
          },
        });
        await tx.user.delete({ where: { id: privacyRequest.userId } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      completed++;
    } catch (error) {
      const attempts = privacyRequest.attempts + 1;
      const soleAdmin = error instanceof Error && error.message === "SOLE_ADMIN";
      const terminal = soleAdmin || attempts >= PRIVACY_MAX_ATTEMPTS;
      await prisma.privacyRequest.updateMany({
        where: { id: privacyRequest.id, status: "PROCESSING" },
        data: terminal
          ? { status: "REJECTED", processingStartedAt: null, lastError: soleAdmin ? "SOLE_ADMIN" : "MAX_ATTEMPTS" }
          : { status: "PENDING", processingStartedAt: null, lastError: "RETRYABLE_FAILURE" },
      });
      if (terminal) rejected++;
    }
  }

  const pending = await prisma.privacyRequest.count({
    where: { status: { in: ["PENDING", "PROCESSING"] } },
  });
  return { completed, rejected, pending };
}

async function runMaintenance(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const pendingAssets = await prisma.mediaAsset.findMany({
    where: { status: "PENDING", createdAt: { lt: oneDayAgo } },
    select: { id: true, publicId: true, resourceType: true },
  });
  const identifiedAssets = pendingAssets.filter(
    (asset): asset is typeof pendingAssets[number] & { publicId: string } => Boolean(asset.publicId)
  );
  const claimedAssets = await Promise.all(
    identifiedAssets.map((asset) =>
      prisma.mediaAsset.updateMany({
        where: { id: asset.id, status: "PENDING", publicId: asset.publicId },
        data: { status: "FAILED" },
      })
    )
  );
  const claimed = identifiedAssets.filter((_, index) => claimedAssets[index]?.count === 1);
  const deletionResults = await Promise.allSettled(
    claimed.map((asset) =>
      deleteCloudinaryAsset(
        asset.publicId,
        asset.resourceType === "video" ? "video" : "image"
      )
    )
  );
  const deletedIds = claimed
    .filter((_, index) => {
      const result = deletionResults[index];
      return result?.status === "fulfilled" && result.value;
    })
    .map((asset) => asset.id);
  const mediaDeleted = await prisma.mediaAsset.deleteMany({
    where: { id: { in: deletedIds }, status: "FAILED" },
  });

  const failedAssets = await prisma.mediaAsset.findMany({
    where: { status: "FAILED", publicId: { not: null }, createdAt: { lt: oneDayAgo } },
    select: { id: true, publicId: true, resourceType: true },
    take: 100,
  });
  const failedDeletionResults = await Promise.allSettled(
    failedAssets.map((asset) =>
      asset.publicId
        ? deleteCloudinaryAsset(asset.publicId, asset.resourceType === "video" ? "video" : "image")
        : Promise.resolve(false)
    )
  );
  const failedDeletedIds = failedAssets
    .filter((_, index) => {
      const result = failedDeletionResults[index];
      return result?.status === "fulfilled" && result.value;
    })
    .map((asset) => asset.id);
  const failedMediaDeleted = await prisma.mediaAsset.deleteMany({
    where: { id: { in: failedDeletedIds }, status: "FAILED" },
  });

  const [mediaReconciliation, legacyMedia] = await Promise.all([
    reconcileCompletedMediaAssets(),
    backfillLegacyMediaAssets(),
  ]);

  const stalePrivacyRequests = await prisma.privacyRequest.updateMany({
    where: {
      type: "DELETE",
      status: "PENDING",
      reauthVerifiedAt: null,
      requestedAt: { lt: thirtyDaysAgo },
    },
    data: { status: "REJECTED", lastError: "REAUTH_REQUIRED" },
  });

  const [expiredInvites, oldNotifications, anonymizedLogs, expiredReauthChallenges, privacyRequests] = await Promise.all([
    prisma.teamInvite.updateMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      data: { status: "EXPIRED" },
    }),
    prisma.notification.deleteMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    }),
    prisma.activityLog.updateMany({
      where: { createdAt: { lt: thirtyDaysAgo }, anonymizedAt: null },
      data: { actorId: null, metadata: Prisma.JsonNull, anonymizedAt: now },
    }),
    prisma.accountReauthChallenge.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { consumedAt: { lt: thirtyDaysAgo } },
        ],
      },
    }),
    processDeletePrivacyRequests(),
  ]);

   const result = {
     expiredInvites: expiredInvites.count,
     oldNotifications: oldNotifications.count,
     anonymizedLogs: anonymizedLogs.count,
     expiredReauthChallenges: expiredReauthChallenges.count,
     completedPrivacyRequests: privacyRequests.completed,
     rejectedPrivacyRequests: privacyRequests.rejected + stalePrivacyRequests.count,
     pendingPrivacyRequests: privacyRequests.pending,
     mediaDeleted: mediaDeleted.count,
     failedMediaDeleted: failedMediaDeleted.count,
     mediaReconciliation,
     legacyMedia,
     pendingWithoutPublicId: pendingAssets.filter((asset) => !asset.publicId).length,
     timestamp: now.toISOString(),
   };
   logger.info({ event: "maintenance.completed", ...result }, "Maintenance completed");
   return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  return runMaintenance(request);
}

export async function POST(request: NextRequest) {
  return runMaintenance(request);
}
