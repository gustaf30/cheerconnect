import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// DELETE /api/connections/[id] - Remover conexão ou cancelar solicitação
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: otherUserId } = await params;

    // Encontrar a conexão
    const connection = await prisma.connection.findFirst({
      where: {
        OR: [
          { senderId: session.user.id, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: session.user.id },
        ],
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Conexão não encontrada" },
        { status: 404 }
      );
    }

    await prisma.connection.delete({
      where: { id: connection.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError("Erro ao excluir conexão", error);
  }
}
