import { NextResponse } from "next/server";
import { requireAuth, internalError, areUsersBlocked } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { publishRealtimeEvent } from "@/lib/realtime-bus";

// POST /api/connections/[id]/accept - Aceitar solicitação de conexão
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: senderId } = await params;

    if (await areUsersBlocked(session.user.id, senderId)) {
      return NextResponse.json(
        { error: "Não é possível aceitar uma conexão de um usuário bloqueado" },
        { status: 403 }
      );
    }

    // Encontrar conexão pendente onde o usuário atual é o receptor
    const connection = await prisma.connection.findFirst({
      where: {
        senderId,
        receiverId: session.user.id,
        status: "PENDING",
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Solicitação não encontrada" },
        { status: 404 }
      );
    }

    // Buscar info do usuário atual e preferências de notificação do remetente
    const [currentUser, senderPrefs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: senderId },
        select: { notifyConnectionAccepted: true },
      }),
    ]);

    const userSelect = {
      id: true,
      name: true,
      username: true,
      avatar: true,
      positions: true,
      location: true,
    } as const;

    const claimed = await prisma.connection.updateMany({
      where: {
        id: connection.id,
        receiverId: session.user.id,
        status: "PENDING",
      },
      data: { status: "ACCEPTED" },
    });
    if (claimed.count !== 1) {
      return NextResponse.json(
        { error: "Solicitação já foi processada" },
        { status: 409 }
      );
    }

    const updatedConnection = await prisma.connection.findUnique({
      where: { id: connection.id },
      include: {
        sender: { select: userSelect },
        receiver: { select: userSelect },
      },
    });
    if (!updatedConnection) {
      return NextResponse.json(
        { error: "Solicitação não encontrada" },
        { status: 404 }
      );
    }

    // Criar notificação para o remetente original (se habilitado)
    if (senderPrefs?.notifyConnectionAccepted) {
      const actorName = currentUser?.name ?? "Alguém";
      await prisma.notification.create({
        data: {
          userId: senderId,
          type: "CONNECTION_ACCEPTED",
          message: `${actorName} aceitou sua conexão`,
          actorId: session.user.id,
          relatedId: connection.id,
          relatedType: "connection",
        },
      });
    }

     publishRealtimeEvent({ userId: senderId, type: "notification" });
     return NextResponse.json({ connection: updatedConnection });
  } catch (error) {
    return internalError("Erro ao aceitar conexão", error);
  }
}
