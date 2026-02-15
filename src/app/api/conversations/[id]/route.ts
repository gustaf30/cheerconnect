import { NextResponse } from "next/server";
import { requireAuth, internalError, getConversationWithAccessCheck } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET /api/conversations/[id] - Buscar detalhes da conversa
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;
    const userId = session.user.id;

    const conversation = await getConversationWithAccessCheck(id, userId);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada" },
        { status: 404 }
      );
    }

    const otherParticipant =
      conversation.participant1Id === userId
        ? conversation.participant2
        : conversation.participant1;

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        otherParticipant,
        lastMessageAt: conversation.lastMessageAt,
        lastMessagePreview: conversation.lastMessagePreview,
        createdAt: conversation.createdAt,
      },
    });
  } catch (error) {
    return internalError("Erro ao buscar conversa", error);
  }
}

// DELETE /api/conversations/[id] - Excluir conversa
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;
    const userId = session.user.id;

    const conversation = await getConversationWithAccessCheck(id, userId);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada" },
        { status: 404 }
      );
    }

    await prisma.conversation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError("Erro ao excluir conversa", error);
  }
}
