import { NextResponse } from "next/server";
import { requireAuth, internalError, getBlockedUserIds } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET /api/messages/count - Buscar contagem de mensagens não lidas
export async function GET() {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const userId = session.user.id;

    const blockedUserIds = await getBlockedUserIds(userId);
    const count = await prisma.message.count({
      where: {
        isRead: false,
        senderId: { notIn: [userId, ...blockedUserIds] },
        conversation: {
          OR: [
            { participant1Id: userId },
            { participant2Id: userId },
          ],
        },
      },
    });

    return NextResponse.json({ count }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return internalError("Erro ao buscar contagem de mensagens não lidas", error);
  }
}
