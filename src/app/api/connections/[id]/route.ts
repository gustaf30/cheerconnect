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

     const result = await prisma.connection.deleteMany({
       where: {
         OR: [
           { senderId: session.user.id, receiverId: otherUserId },
           { senderId: otherUserId, receiverId: session.user.id },
         ],
       },
     });
     if (result.count === 0) {
       return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
     }

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError("Erro ao excluir conexão", error);
  }
}
