import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// POST /api/posts/[id]/like - Curtir/descurtir um post (toggle)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: postId } = await params;

    // Verificar se o post existe e obter info do autor
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
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

    // Try to create the like; if unique constraint fails (P2002), it already exists — delete instead
    try {
      await prisma.$transaction(async (tx) => {
        await tx.like.create({
          data: {
            userId: session.user.id,
            postId,
          },
        });

        // Criar notificação para o autor do post (não para si mesmo)
        if (post.author.id !== session.user.id) {
          const [currentUser, postAuthor] = await Promise.all([
            tx.user.findUnique({
              where: { id: session.user.id },
              select: { name: true, username: true },
            }),
            tx.user.findUnique({
              where: { id: post.author.id },
              select: { notifyPostLiked: true },
            }),
          ]);

          if (postAuthor?.notifyPostLiked) {
            const actorName = currentUser?.name ?? currentUser?.username ?? "Alguém";
            await tx.notification.create({
              data: {
                userId: post.author.id,
                type: "POST_LIKED",
                message: `${actorName} curtiu sua publicação`,
                actorId: session.user.id,
                relatedId: postId,
                relatedType: "post",
              },
            });
          }
        }
      });

      return NextResponse.json({ liked: true });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // Already liked — toggle off
        await prisma.like.deleteMany({
          where: {
            userId: session.user.id,
            postId,
          },
        });
        return NextResponse.json({ liked: false });
      }
      throw err;
    }
  } catch (error) {
    return internalError("Erro ao curtir post", error);
  }
}

// DELETE /api/posts/[id]/like - Descurtir um post
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: postId } = await params;

    const result = await prisma.like.deleteMany({
      where: {
        userId: session.user.id,
        postId,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Você não curtiu este post" },
        { status: 404 }
      );
    }

    return NextResponse.json({ liked: false });
  } catch (error) {
    return internalError("Erro ao descurtir post", error);
  }
}
