import { NextRequest, NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET /api/comments/[id]/replies - Buscar respostas de um comentário
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: commentId } = await params;
    const { searchParams } = new URL(request.url);

    const offset = parseInt(searchParams.get("offset") || "0");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    // Verificar se o comentário existe
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, parentId: true },
    });

    if (!comment) {
      return NextResponse.json(
        { error: "Comentário não encontrado" },
        { status: 404 }
      );
    }

    // Apenas comentários de nível superior podem ter respostas
    if (comment.parentId !== null) {
      return NextResponse.json(
        { error: "Respostas não podem ter respostas" },
        { status: 400 }
      );
    }

    // Buscar respostas
    const replies = await prisma.comment.findMany({
      where: { parentId: commentId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        likes: {
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            likes: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      skip: offset,
      take: limit,
    });

    // Transformar respostas
    const transformedReplies = replies.map((reply) => ({
      id: reply.id,
      content: reply.content,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
      author: reply.author,
      likesCount: reply._count.likes,
      isLiked: reply.likes.some((like) => like.userId === session.user.id),
      parentId: reply.parentId,
    }));

    return NextResponse.json({
      replies: transformedReplies,
    });
  } catch (error) {
    return internalError("Erro ao buscar respostas", error);
  }
}
