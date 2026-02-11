import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET /api/messages/count - Buscar contagem de mensagens não lidas
export async function GET() {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const userId = session.user.id;

    // Contar mensagens não lidas onde o usuário é o destinatário (não o remetente)
    const count = await prisma.message.count({
      where: {
        isRead: false,
        senderId: { not: userId },
        conversation: {
          OR: [
            { participant1Id: userId },
            { participant2Id: userId },
          ],
        },
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    return internalError("Erro ao buscar contagem de mensagens não lidas", error);
  }
}
