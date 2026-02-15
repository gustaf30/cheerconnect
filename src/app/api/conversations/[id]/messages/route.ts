import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError, getConversationWithAccessCheck } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const sendMessageSchema = z.object({
  content: z.string().min(1, "Mensagem não pode estar vazia").max(2000, "Mensagem muito longa"),
});

// GET /api/conversations/[id]/messages - Listar mensagens (paginado)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: conversationId } = await params;
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    // Verificar se o usuário faz parte da conversa
    const conversation = await getConversationWithAccessCheck(conversationId, userId);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada" },
        { status: 404 }
      );
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: "asc" },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? resultMessages[resultMessages.length - 1]?.id ?? null : null;

    return NextResponse.json({
      messages: resultMessages,
      nextCursor,
    });
  } catch (error) {
    return internalError("Erro ao buscar mensagens", error);
  }
}

// POST /api/conversations/[id]/messages - Enviar mensagem
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: conversationId } = await params;
    const userId = session.user.id;
    const body = await request.json();
    const { content } = sendMessageSchema.parse(body);

    // Verificar se o usuário faz parte da conversa
    const conversation = await getConversationWithAccessCheck(conversationId, userId);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada" },
        { status: 404 }
      );
    }

    const recipientId =
      conversation.participant1Id === userId
        ? conversation.participant2Id
        : conversation.participant1Id;

    // Buscar informações do remetente e destinatário para notificação
    const [sender, recipient] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: recipientId },
        select: { notifyMessageReceived: true },
      }),
    ]);

    // Criar mensagem e atualizar conversa em transação
    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          content,
          senderId: userId,
          conversationId,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
        },
      });

      // Atualizar conversa com informações da última mensagem
      const preview = content.length > 50 ? content.substring(0, 50) + "..." : content;
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: msg.createdAt,
          lastMessagePreview: preview,
        },
      });

      // Criar notificação se o destinatário tem habilitado
      if (recipient?.notifyMessageReceived) {
        await tx.notification.create({
          data: {
            userId: recipientId,
            type: "MESSAGE_RECEIVED",
            message: `${sender?.name || "Alguém"} enviou uma mensagem`,
            actorId: userId,
            relatedId: conversationId,
            relatedType: "conversation",
          },
        });
      }

      return msg;
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao enviar mensagem", error);
  }
}
