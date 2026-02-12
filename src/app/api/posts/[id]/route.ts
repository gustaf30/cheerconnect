import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { deletePostAssets } from "@/lib/cloudinary";

const updatePostSchema = z.object({
  content: z.string().min(1, "Conteúdo é obrigatório").max(5000),
});

// GET /api/posts/[id] - Buscar um post específico
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    const post = await prisma.post.findUnique({
      where: { id },
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
            likes: session?.user?.id
              ? {
                  where: { userId: session.user.id },
                  select: { id: true },
                }
              : false,
          },
        },
        comments: {
          orderBy: { createdAt: "desc" },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
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
        likes: session?.user?.id
          ? {
              where: { userId: session.user.id },
              select: { id: true },
            }
          : false,
      },
    });

    if (!post) {
      return NextResponse.json(
        { error: "Post não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      post: {
        ...post,
        isLiked: Array.isArray(post.likes) && post.likes.length > 0,
        likes: undefined,
        originalPost: post.originalPost
          ? {
              ...post.originalPost,
              isLiked:
                Array.isArray(post.originalPost.likes) &&
                post.originalPost.likes.length > 0,
              likes: undefined,
            }
          : null,
      },
    });
  } catch (error) {
    return internalError("Erro ao buscar post", error);
  }
}

// DELETE /api/posts/[id] - Excluir um post
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;

    const post = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true, images: true, videoUrl: true },
    });

    if (!post) {
      return NextResponse.json(
        { error: "Post não encontrado" },
        { status: 404 }
      );
    }

    if (post.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "Você não tem permissão para excluir este post" },
        { status: 403 }
      );
    }

    // Excluir assets do Cloudinary (fire-and-forget, não bloqueia o delete)
    try {
      await deletePostAssets(post);
    } catch (err) {
      console.error("Falha ao excluir assets do post no Cloudinary:", err);
    }

    await prisma.post.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError("Erro ao excluir post", error);
  }
}

// PUT /api/posts/[id] - Editar um post
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;

    const post = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true, originalPostId: true },
    });

    if (!post) {
      return NextResponse.json(
        { error: "Post não encontrado" },
        { status: 404 }
      );
    }

    if (post.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "Você não tem permissão para editar este post" },
        { status: 403 }
      );
    }

    if (post.originalPostId) {
      return NextResponse.json(
        { error: "Não é possível editar um repost" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { content } = updatePostSchema.parse(body);

    const updatedPost = await prisma.post.update({
      where: { id },
      data: { content },
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
        likes: {
          where: { userId: session.user.id },
          select: { id: true },
        },
      },
    });

    return NextResponse.json({
      post: {
        ...updatedPost,
        isLiked: updatedPost.likes.length > 0,
        likes: undefined,
      },
    });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao editar post", error);
  }
}
