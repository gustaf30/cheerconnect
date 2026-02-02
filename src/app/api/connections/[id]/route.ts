import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/connections/[id] - Remove connection or cancel request
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: otherUserId } = await params;

    // Find the connection
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
    console.error("Delete connection error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
