import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

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
        messages: {
          where: {
            isRead: false,
            senderId: { not: userId },
          },
          select: { id: true },
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
        unreadCount: conv.messages.length,
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

    // Verificar se a conversa já existe (em ambas as direções)
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { participant1Id: userId, participant2Id: participantId },
          { participant1Id: participantId, participant2Id: userId },
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
      },
    });

    if (existingConversation) {
      const otherParticipant =
        existingConversation.participant1Id === userId
          ? existingConversation.participant2
          : existingConversation.participant1;

      return NextResponse.json({
        conversation: {
          id: existingConversation.id,
          otherParticipant,
          lastMessageAt: existingConversation.lastMessageAt,
          lastMessagePreview: existingConversation.lastMessagePreview,
          createdAt: existingConversation.createdAt,
        },
        isNew: false,
      });
    }

    // Criar nova conversa
    const conversation = await prisma.conversation.create({
      data: {
        participant1Id: userId,
        participant2Id: participantId,
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
      },
    });

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
        isNew: true,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao criar conversa", error);
  }
}
