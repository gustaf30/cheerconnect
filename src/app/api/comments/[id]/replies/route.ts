import { NextRequest, NextResponse } from "next/server";
import { requireAuth, internalError, parsePaginationLimit, getBlockedUserIds, areUsersBlocked } from "@/lib/api-utils";
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

     const rawOffset = searchParams.get("offset");
     const offset = rawOffset === null ? 0 : Number(rawOffset);
     const cursor = searchParams.get("cursor");
     if (rawOffset !== null && (!Number.isInteger(offset) || offset < 0)) {
       return NextResponse.json({ error: "Offset inválido" }, { status: 400 });
     }
     const limit = parsePaginationLimit(searchParams, 10);

    // Verificar se o comentário existe
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        parentId: true,
        post: { select: { authorId: true } },
      },
    });

    if (!comment) {
      return NextResponse.json(
        { error: "Comentário não encontrado" },
        { status: 404 }
      );
    }

    if (await areUsersBlocked(session.user.id, comment.post.authorId)) {
      return NextResponse.json(
        { error: "Não é possível acessar estas respostas" },
        { status: 403 }
      );
    }

    // Apenas comentários de nível superior podem ter respostas
    if (comment.parentId !== null) {
      return NextResponse.json(
        { error: "Respostas não podem ter respostas" },
        { status: 400 }
      );
    }

    const blockedUserIds = await getBlockedUserIds(session.user.id);

    // Buscar respostas
    const replies = await prisma.comment.findMany({
      where: { parentId: commentId, authorId: { notIn: blockedUserIds } },
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
          where: { userId: session.user.id },
          select: { id: true },
          take: 1,
        },
        _count: {
          select: {
            likes: true,
          },
        },
      },
       orderBy: [{ createdAt: "asc" }, { id: "asc" }],
       ...(cursor ? { skip: 1, cursor: { id: cursor } } : { skip: offset }),
       take: limit + 1,
    });

     const hasMore = replies.length > limit;
     const pageReplies = hasMore ? replies.slice(0, limit) : replies;
     const transformedReplies = pageReplies.map((reply) => ({
      id: reply.id,
      content: reply.content,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
      author: reply.author,
      likesCount: reply._count.likes,
      isLiked: reply.likes.length > 0,
      parentId: reply.parentId,
    }));

     return NextResponse.json({
       replies: transformedReplies,
       nextCursor: hasMore ? pageReplies[pageReplies.length - 1]?.id ?? null : null,
     });
  } catch (error) {
    return internalError("Erro ao buscar respostas", error);
  }
}
