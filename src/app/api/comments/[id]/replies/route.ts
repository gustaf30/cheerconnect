import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/comments/[id]/replies - Get replies for a comment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: commentId } = await params;
    const { searchParams } = new URL(request.url);

    const offset = parseInt(searchParams.get("offset") || "0");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    // Check if comment exists
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

    // Only top-level comments can have replies
    if (comment.parentId !== null) {
      return NextResponse.json(
        { error: "Respostas não podem ter respostas" },
        { status: 400 }
      );
    }

    // Fetch replies
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

    // Transform replies
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
    console.error("Get replies error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
