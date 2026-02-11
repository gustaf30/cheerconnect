import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// POST /api/posts/[id]/like - Curtir um post
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: postId } = await params;

    // Verificar se o post existe e obter info do autor
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

    // Verificar se já curtiu
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_postId: {
          userId: session.user.id,
          postId,
        },
      },
    });

    if (existingLike) {
      return NextResponse.json(
        { error: "Você já curtiu este post" },
        { status: 400 }
      );
    }

    // Buscar usuário atual e preferências do autor do post
    const [currentUser, postAuthor] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: post.author.id },
        select: { notifyPostLiked: true },
      }),
    ]);

    await prisma.like.create({
      data: {
        userId: session.user.id,
        postId,
      },
    });

    // Criar notificação para o autor do post (não para si mesmo, se habilitado)
    if (post.author.id !== session.user.id && postAuthor?.notifyPostLiked) {
      await prisma.notification.create({
        data: {
          userId: post.author.id,
          type: "POST_LIKED",
          message: `${currentUser?.name || "Alguém"} curtiu sua publicação`,
          actorId: session.user.id,
          relatedId: postId,
          relatedType: "post",
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError("Erro ao curtir post", error);
  }
}

// DELETE /api/posts/[id]/like - Descurtir um post
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: postId } = await params;

    await prisma.like.delete({
      where: {
        userId_postId: {
          userId: session.user.id,
          postId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError("Erro ao descurtir post", error);
  }
}
