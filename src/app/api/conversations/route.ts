import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth, handleZodError, internalError, parsePaginationLimit } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createConversationSchema = z.object({
  participantId: z.string().min(1, "participantId é obrigatório"),
});

// GET /api/conversations - Listar conversas do usuário
export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parsePaginationLimit(searchParams);

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { participant1Id: userId },
          { participant2Id: userId },
        ],
      },
      include: {
        participant1: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        participant2: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                isRead: false,
                senderId: { not: userId },
              },
            },
          },
        },
      },
      orderBy: {
        lastMessageAt: { sort: "desc", nulls: "last" },
      },
      take: limit,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });

    // Transformar para incluir o "outro" participante e contagem de não lidas
    const transformedConversations = conversations.map((conv) => {
      const otherParticipant =
        conv.participant1Id === userId ? conv.participant2 : conv.participant1;

      return {
        id: conv.id,
        otherParticipant,
        lastMessageAt: conv.lastMessageAt,
        lastMessagePreview: conv.lastMessagePreview,
        unreadCount: conv._count.messages,
        createdAt: conv.createdAt,
      };
    });

    const nextCursor = conversations.length === limit ? conversations[conversations.length - 1]?.id : null;

    return NextResponse.json({ conversations: transformedConversations, nextCursor });
  } catch (error) {
    return internalError("Erro ao buscar conversas", error);
  }
}

// POST /api/conversations - Iniciar nova conversa
export async function POST(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const { participantId } = createConversationSchema.parse(body);

    const userId = session.user.id;

    // Não pode criar conversa consigo mesmo
    if (participantId === userId) {
      return NextResponse.json(
        { error: "Não é possível iniciar conversa consigo mesmo" },
        { status: 400 }
      );
    }

    // Verificar se o participante existe
    const participant = await prisma.user.findUnique({
      where: { id: participantId },
      select: { id: true },
    });

    if (!participant) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se existe conexão aceita entre os usuários
    const connection = await prisma.connection.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { senderId: userId, receiverId: participantId },
          { senderId: participantId, receiverId: userId },
        ],
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Você precisa estar conectado com este usuário para enviar mensagens" },
        { status: 403 }
      );
    }

    const participantSelect = {
      id: true,
      name: true,
      username: true,
      avatar: true,
    } as const;

    // Tenta criar; captura P2002 (unique constraint) e retorna existente
    let conversation;
    let isNew = true;

    try {
      conversation = await prisma.conversation.create({
        data: {
          participant1Id: userId,
          participant2Id: participantId,
        },
        include: {
          participant1: { select: participantSelect },
          participant2: { select: participantSelect },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // Conversa já existe — buscar e retornar
        conversation = await prisma.conversation.findFirst({
          where: {
            OR: [
              { participant1Id: userId, participant2Id: participantId },
              { participant1Id: participantId, participant2Id: userId },
            ],
          },
          include: {
            participant1: { select: participantSelect },
            participant2: { select: participantSelect },
          },
        });

        if (!conversation) {
          return NextResponse.json(
            { error: "Erro ao buscar conversa existente" },
            { status: 500 }
          );
        }
        isNew = false;
      } else {
        throw err;
      }
    }

    const otherParticipant =
      conversation.participant1Id === userId
        ? conversation.participant2
        : conversation.participant1;

    return NextResponse.json(
      {
        conversation: {
          id: conversation.id,
          otherParticipant,
          lastMessageAt: conversation.lastMessageAt,
          lastMessagePreview: conversation.lastMessagePreview,
          createdAt: conversation.createdAt,
        },
        isNew,
      },
      { status: isNew ? 201 : 200 }
    );
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao criar conversa", error);
  }
}
