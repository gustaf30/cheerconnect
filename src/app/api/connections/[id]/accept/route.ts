import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/connections/[id]/accept - Accept connection request
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: senderId } = await params;

    // Find pending connection where current user is the receiver
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

    // Get current user info for notification message
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });

    const updatedConnection = await prisma.connection.update({
      where: { id: connection.id },
      data: { status: "ACCEPTED" },
    });

    // Create notification for the original sender
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

    return NextResponse.json({ connection: updatedConnection });
  } catch (error) {
    console.error("Accept connection error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
