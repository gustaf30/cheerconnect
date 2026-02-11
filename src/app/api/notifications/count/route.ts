import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET /api/notifications/count - Buscar contagem de notificações não lidas
export async function GET() {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const count = await prisma.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
        type: { not: "MESSAGE_RECEIVED" },
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    return internalError("Erro ao buscar contagem de notificações", error);
  }
}
