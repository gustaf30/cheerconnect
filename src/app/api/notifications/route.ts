import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET /api/notifications - Listar notificações do usuário (cursor-based)
export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const cursor = searchParams.get("cursor");

    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        type: { not: "MESSAGE_RECEIVED" },
        ...(unreadOnly && { isRead: false }),
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
    });

    const hasMore = notifications.length > limit;
    const data = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

    return NextResponse.json({
      notifications: data,
      meta: { nextCursor },
    });
  } catch (error) {
    return internalError("Erro ao buscar notificações", error);
  }
}

const markReadSchema = z.object({
  ids: z.array(z.string()).max(100).optional(),
  all: z.boolean().optional(),
});

// PATCH /api/notifications - Marcar notificações como lidas
export async function PATCH(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const { ids, all } = markReadSchema.parse(body);

    if (all) {
      await prisma.notification.updateMany({
        where: {
          userId: session.user.id,
          isRead: false,
        },
        data: { isRead: true },
      });
    } else if (ids && ids.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: ids },
          userId: session.user.id,
        },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao marcar notificações como lidas", error);
  }
}
