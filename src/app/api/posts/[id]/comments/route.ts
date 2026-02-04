import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createCommentSchema = z.object({
  content: z.string().min(1, "Comentário é obrigatório").max(1000),
  parentId: z.string().optional(),
});

// GET /api/posts/[id]/comments - Get comments for a post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: postId } = await params;
    const { searchParams } = new URL(request.url);

    const sort = searchParams.get("sort") || "popular"; // "popular" or "recent"
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!post) {
      return NextResponse.json(
        { error: "Post não encontrado" },
        { status: 404 }
      );
    }

    // Base query conditions - only fetch top-level comments (parentId: null)
    const whereCondition = {
      postId,
      parentId: null,
      ...(cursor ? { id: { lt: cursor } } : {}),
    };

    // Fetch comments with replies
    const comments = await prisma.comment.findMany({
      where: whereCondition,
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
            replies: true,
          },
        },
        replies: {
          take: 3,
          orderBy: { createdAt: "asc" },
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
        },
      },
      orderBy: sort === "recent"
        ? { createdAt: "desc" }
        : undefined, // We'll sort by likes count in memory for "popular"
      take: sort === "recent" ? limit + 1 : undefined, // Only apply limit for recent
    });

    // For popular sorting, sort in memory by likes count
    let sortedComments = comments;
    if (sort === "popular") {
      sortedComments = [...comments].sort((a, b) => b._count.likes - a._count.likes);
      // Apply cursor pagination for popular
      if (cursor) {
        const cursorIndex = sortedComments.findIndex(c => c.id === cursor);
        if (cursorIndex !== -1) {
          sortedComments = sortedComments.slice(cursorIndex + 1);
        }
      }
      sortedComments = sortedComments.slice(0, limit + 1);
    }

    // Check if there are more results
    const hasMore = sortedComments.length > limit;
    const resultComments = hasMore ? sortedComments.slice(0, limit) : sortedComments;

    // Transform comments to include isLiked flag and replies
    const transformedComments = resultComments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: comment.author,
      likesCount: comment._count.likes,
      repliesCount: comment._count.replies,
      isLiked: comment.likes.some((like) => like.userId === session.user.id),
      replies: comment.replies.map((reply) => ({
        id: reply.id,
        content: reply.content,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        author: reply.author,
        likesCount: reply._count.likes,
        isLiked: reply.likes.some((like) => like.userId === session.user.id),
        parentId: comment.id,
      })),
    }));

    return NextResponse.json({
      comments: transformedComments,
      nextCursor: hasMore ? resultComments[resultComments.length - 1].id : null,
      hasMore,
    });
  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST /api/posts/[id]/comments - Create a comment
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: postId } = await params;

    // Check if post exists and get author info
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: { id: true },
        },
      },
    });

    if (!post) {
      return NextResponse.json(
        { error: "Post não encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { content, parentId } = createCommentSchema.parse(body);

    // If replying to a comment, validate parent
    let parentComment = null;
    if (parentId) {
      parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        include: {
          author: {
            select: { id: true, name: true },
          },
        },
      });

      if (!parentComment) {
        return NextResponse.json(
          { error: "Comentário pai não encontrado" },
          { status: 404 }
        );
      }

      if (parentComment.postId !== postId) {
        return NextResponse.json(
          { error: "Comentário pai não pertence a este post" },
          { status: 400 }
        );
      }

      // Prevent nested replies (only one level of nesting allowed)
      if (parentComment.parentId !== null) {
        return NextResponse.json(
          { error: "Não é possível responder a uma resposta" },
          { status: 400 }
        );
      }
    }

    // Get current user info for notification message
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });

    const comment = await prisma.comment.create({
      data: {
        content,
        authorId: session.user.id,
        postId,
        parentId: parentId || null,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            likes: true,
          },
        },
      },
    });

    // Create notification
    if (parentId && parentComment) {
      // Notify parent comment author about reply (not self)
      if (parentComment.author.id !== session.user.id) {
        await prisma.notification.create({
          data: {
            userId: parentComment.author.id,
            type: "COMMENT_REPLIED",
            message: `${currentUser?.name || "Alguém"} respondeu seu comentário`,
            actorId: session.user.id,
            relatedId: postId,
            relatedType: "post",
          },
        });
      }
    } else {
      // Notify post author about comment (not self)
      if (post.author.id !== session.user.id) {
        await prisma.notification.create({
          data: {
            userId: post.author.id,
            type: "POST_COMMENTED",
            message: `${currentUser?.name || "Alguém"} comentou sua publicação`,
            actorId: session.user.id,
            relatedId: postId,
            relatedType: "post",
          },
        });
      }
    }

    // Return transformed comment
    const transformedComment = {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: comment.author,
      likesCount: comment._count.likes,
      isLiked: false,
      parentId: comment.parentId,
    };

    return NextResponse.json({ comment: transformedComment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Create comment error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
