import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createConnectionSchema = z.object({
  receiverId: z.string(),
});

// GET /api/connections - Buscar conexões do usuário
export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "ACCEPTED";
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    // Fetch blocked user IDs (bidirectional)
    const [blockedByMe, blockedMe] = await Promise.all([
      prisma.block.findMany({ where: { userId: session.user.id }, select: { blockedUserId: true } }),
      prisma.block.findMany({ where: { blockedUserId: session.user.id }, select: { userId: true } }),
    ]);
    const blockedIds = [...blockedByMe.map(b => b.blockedUserId), ...blockedMe.map(b => b.userId)];

    let connections = await prisma.connection.findMany({
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
      take: limit,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });

    // Filter out connections with blocked users
    if (blockedIds.length > 0) {
      const blockedSet = new Set(blockedIds);
      connections = connections.filter(c => {
        const otherId = c.senderId === session.user.id ? c.receiverId : c.senderId;
        return !blockedSet.has(otherId);
      });
    }

    // Formatar conexões para mostrar o outro usuário
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

    const nextCursor = connections.length === limit ? connections[connections.length - 1]?.id : null;

    return NextResponse.json({ connections: formattedConnections, nextCursor });
  } catch (error) {
    return internalError("Erro ao buscar conexões", error);
  }
}

// POST /api/connections - Enviar solicitação de conexão
export async function POST(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const { receiverId } = createConnectionSchema.parse(body);

    if (receiverId === session.user.id) {
      return NextResponse.json(
        { error: "Você não pode se conectar consigo mesmo" },
        { status: 400 }
      );
    }

    // Verificar se o usuário existe
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se a conexão já existe
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

    // Buscar info do usuário atual e preferências de notificação do receptor
    const [currentUser, receiverPrefs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: receiverId },
        select: { notifyConnectionRequest: true },
      }),
    ]);

    const connection = await prisma.connection.create({
      data: {
        senderId: session.user.id,
        receiverId,
      },
    });

    // Criar notificação para o receptor (se habilitado)
    if (receiverPrefs?.notifyConnectionRequest) {
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
    }

    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao criar conexão", error);
  }
}
