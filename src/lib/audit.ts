import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";

interface LogActivityParams {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  metadata?: Record<string, unknown>;
}

export function logActivity(params: LogActivityParams): void {
  // Fire-and-forget — don't await, don't block the response
  prisma.activityLog
    .create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        actorId: params.actorId,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    })
    .catch((err) => {
      logger.error({ err }, "[audit] Failed to log activity");
    });
}
