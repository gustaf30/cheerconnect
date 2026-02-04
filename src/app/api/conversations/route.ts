import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createConversationSchema = z.object({
  participantId: z.string().min(1, "participantId é obrigatório"),
});

// GET /api/conversations - List user's conversations
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userId = session.user.id;

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
    });

    // Transform to include the "other" participant and unread count
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

    return NextResponse.json({ conversations: transformedConversations });
  } catch (error) {
    console.error("Get conversations error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST /api/conversations - Start a new conversation
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { participantId } = createConversationSchema.parse(body);

    const userId = session.user.id;

    // Can't create conversation with self
    if (participantId === userId) {
      return NextResponse.json(
        { error: "Não é possível iniciar conversa consigo mesmo" },
        { status: 400 }
      );
    }

    // Check if participant exists
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

    // Check if there's an accepted connection between users
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

    // Check if conversation already exists (in either direction)
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

    // Create new conversation
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Create conversation error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
