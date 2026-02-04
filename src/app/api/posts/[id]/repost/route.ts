import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const repostSchema = z.object({
  content: z.string().max(5000).optional(),
});

// POST /api/posts/[id]/repost - Repost a post
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

    // Get the original post
    const originalPost = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        originalPostId: true,
        author: {
          select: { id: true, name: true },
        },
      },
    });

    if (!originalPost) {
      return NextResponse.json(
        { error: "Post não encontrado" },
        { status: 404 }
      );
    }

    // Can't repost own post
    if (originalPost.authorId === session.user.id) {
      return NextResponse.json(
        { error: "Você não pode repostar sua própria publicação" },
        { status: 400 }
      );
    }

    // Can't repost a repost - must repost the original
    if (originalPost.originalPostId) {
      return NextResponse.json(
        { error: "Você não pode repostar um repost. Reposte a publicação original." },
        { status: 400 }
      );
    }

    // Check if user already reposted this
    const existingRepost = await prisma.post.findFirst({
      where: {
        authorId: session.user.id,
        originalPostId: postId,
      },
    });

    if (existingRepost) {
      return NextResponse.json(
        { error: "Você já repostou esta publicação" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { content } = repostSchema.parse(body);

    // Get current user info
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });

    // Create the repost
    const repost = await prisma.post.create({
      data: {
        content: content || "",
        authorId: session.user.id,
        originalPostId: postId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            positions: true,
          },
        },
        originalPost: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
                positions: true,
              },
            },
            team: {
              select: {
                id: true,
                name: true,
                slug: true,
                logo: true,
              },
            },
            _count: {
              select: {
                likes: true,
                comments: true,
                reposts: true,
              },
            },
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            reposts: true,
          },
        },
      },
    });

    // Create notification for original post author
    await prisma.notification.create({
      data: {
        userId: originalPost.authorId,
        type: "POST_REPOSTED",
        message: `${currentUser?.name || "Alguém"} repostou sua publicação`,
        actorId: session.user.id,
        relatedId: repost.id,
        relatedType: "post",
      },
    });

    return NextResponse.json({
      post: {
        ...repost,
        isLiked: false,
        originalPost: repost.originalPost
          ? {
              ...repost.originalPost,
              isLiked: false,
            }
          : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Repost error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/posts/[id]/repost - Remove a repost
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: postId } = await params;

    // Find user's repost of this original post
    const repost = await prisma.post.findFirst({
      where: {
        authorId: session.user.id,
        originalPostId: postId,
      },
    });

    if (!repost) {
      return NextResponse.json(
        { error: "Repost não encontrado" },
        { status: 404 }
      );
    }

    // Delete the repost
    await prisma.post.delete({
      where: { id: repost.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete repost error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
