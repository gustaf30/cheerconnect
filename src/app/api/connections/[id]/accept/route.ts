import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// POST /api/connections/[id]/accept - Aceitar solicitação de conexão
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: senderId } = await params;

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

    const updatedConnection = await prisma.connection.update({
      where: { id: connection.id },
      data: { status: "ACCEPTED" },
    });

    // Criar notificação para o remetente original (se habilitado)
    if (senderPrefs?.notifyConnectionAccepted) {
      await prisma.notification.create({
        data: {
          userId: senderId,
          type: "CONNECTION_ACCEPTED",
          message: `${currentUser?.name || "Alguém"} aceitou sua conexão`,
          actorId: session.user.id,
          relatedId: connection.id,
          relatedType: "connection",
        },
      });
    }

    return NextResponse.json({ connection: updatedConnection });
  } catch (error) {
    return internalError("Erro ao aceitar conexão", error);
  }
}
