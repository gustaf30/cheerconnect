import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const repostSchema = z.object({
  content: z.string().max(5000).optional(),
});

// POST /api/posts/[id]/repost - Repostar um post
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: postId } = await params;

    // Buscar o post original
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

    // Não pode repostar o próprio post
    if (originalPost.authorId === session.user.id) {
      return NextResponse.json(
        { error: "Você não pode repostar sua própria publicação" },
        { status: 400 }
      );
    }

    // Não pode repostar um repost - deve repostar o original
    if (originalPost.originalPostId) {
      return NextResponse.json(
        { error: "Você não pode repostar um repost. Reposte a publicação original." },
        { status: 400 }
      );
    }

    let body: unknown;
    const rawText = await request.text();
    if (rawText.trim().length === 0) {
      // Corpo vazio é válido (repost sem comentário)
      body = {};
    } else {
      try {
        body = JSON.parse(rawText);
      } catch {
        return NextResponse.json(
          { error: "JSON malformado no corpo da requisição" },
          { status: 400 }
        );
      }
    }
    const { content } = repostSchema.parse(body);

    // Buscar info do usuário atual e preferências do autor original
    const [currentUser, originalAuthorPrefs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, username: true },
      }),
      prisma.user.findUnique({
        where: { id: originalPost.authorId },
        select: { notifyPostReposted: true },
      }),
    ]);

    // Criar o repost — captura P2002 para unique constraint (authorId, originalPostId)
    let repost;
    try {
      repost = await prisma.post.create({
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
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "Você já repostou esta publicação" },
          { status: 400 }
        );
      }
      throw err;
    }

    // Criar notificação para o autor do post original (se habilitado)
    if (originalAuthorPrefs?.notifyPostReposted) {
      const actorName = currentUser?.name ?? currentUser?.username ?? "Alguém";
      await prisma.notification.create({
        data: {
          userId: originalPost.authorId,
          type: "POST_REPOSTED",
          message: `${actorName} repostou sua publicação`,
          actorId: session.user.id,
          relatedId: postId,
          relatedType: "post",
        },
      });
    }

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
    return handleZodError(error) ?? internalError("Erro ao repostar", error);
  }
}

// DELETE /api/posts/[id]/repost - Remover um repost
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: postId } = await params;

    // Encontrar o repost do usuário para este post original
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

    // Excluir o repost
    await prisma.post.delete({
      where: { id: repost.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError("Erro ao excluir repost", error);
  }
}
