import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createConnectionSchema = z.object({
  receiverId: z.string(),
});

// GET /api/connections - Get user's connections
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "ACCEPTED";

    const connections = await prisma.connection.findMany({
      where: {
        status: status as "PENDING" | "ACCEPTED" | "REJECTED",
        OR: [
          { senderId: session.user.id },
          { receiverId: session.user.id },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            positions: true,
            location: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            positions: true,
            location: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Format connections to show the other user
    const formattedConnections = connections.map((connection) => ({
      id: connection.id,
      status: connection.status,
      createdAt: connection.createdAt,
      user:
        connection.senderId === session.user.id
          ? connection.receiver
          : connection.sender,
      isSender: connection.senderId === session.user.id,
    }));

    return NextResponse.json({ connections: formattedConnections });
  } catch (error) {
    console.error("Get connections error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST /api/connections - Send connection request
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { receiverId } = createConnectionSchema.parse(body);

    if (receiverId === session.user.id) {
      return NextResponse.json(
        { error: "Você não pode se conectar consigo mesmo" },
        { status: 400 }
      );
    }

    // Check if user exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    // Check if connection already exists
    const existingConnection = await prisma.connection.findFirst({
      where: {
        OR: [
          { senderId: session.user.id, receiverId },
          { senderId: receiverId, receiverId: session.user.id },
        ],
      },
    });

    if (existingConnection) {
      return NextResponse.json(
        { error: "Já existe uma conexão ou solicitação pendente" },
        { status: 400 }
      );
    }

    // Get current user info for notification message
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });

    const connection = await prisma.connection.create({
      data: {
        senderId: session.user.id,
        receiverId,
      },
    });

    // Create notification for receiver
    await prisma.notification.create({
      data: {
        userId: receiverId,
        type: "CONNECTION_REQUEST",
        message: `${currentUser?.name || "Alguém"} quer se conectar com você`,
        actorId: session.user.id,
        relatedId: connection.id,
        relatedType: "connection",
      },
    });

    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Create connection error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
