import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError, getBlockedUserIds } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

const createCommentSchema = z.object({
  content: z.string().min(1, "Comentário é obrigatório").max(1000),
  parentId: z.string().optional(),
});

// GET /api/posts/[id]/comments - Buscar comentários de um post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: postId } = await params;
    const { searchParams } = new URL(request.url);

    const sort = searchParams.get("sort") || "popular"; // "popular" ou "recent"
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    // Verificar se o post existe
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

    // Condições base - buscar apenas comentários de nível superior (parentId: null)
    const whereCondition = {
      postId,
      parentId: null as string | null,
    };

    // Buscar comentários com respostas — ordenação server-side
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
          where: { userId: session.user.id },
          select: { id: true },
          take: 1,
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
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
    });

    // Verificar se há mais resultados
    const hasMore = comments.length > limit;
    const paginatedComments = hasMore ? comments.slice(0, limit) : comments;

    // Sort by popularity client-side (avoids Prisma 7 orderBy edge case)
    const resultComments = sort === "popular"
      ? [...paginatedComments].sort((a, b) => b._count.likes - a._count.likes)
      : paginatedComments;

    // Transformar comentários para incluir flag isLiked e respostas
    const transformedComments = resultComments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: comment.author,
      likesCount: comment._count.likes,
      repliesCount: comment._count.replies,
      isLiked: comment.likes.length > 0,
      replies: comment.replies.map((reply) => ({
        id: reply.id,
        content: reply.content,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        author: reply.author,
        likesCount: reply._count.likes,
        isLiked: reply.likes.length > 0,
        parentId: comment.id,
      })),
    }));

    return NextResponse.json({
      comments: transformedComments,
      nextCursor: hasMore ? resultComments[resultComments.length - 1].id : null,
      hasMore,
    });
  } catch (error) {
    return internalError("Erro ao buscar comentários", error);
  }
}

// POST /api/posts/[id]/comments - Criar um comentário
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    // Rate limit: 10 comentários por minuto
    const COMMENT_LIMIT = 10;
    const COMMENT_WINDOW = 60000;
    const rl = rateLimit(`comment:${session.user.id}`, COMMENT_LIMIT, COMMENT_WINDOW);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Muitos comentários em pouco tempo. Aguarde um momento." },
        { status: 429, headers: rateLimitHeaders(COMMENT_LIMIT, rl.remaining, rl.resetMs) }
      );
    }

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

    // Block comments between blocked users
    const blockedIds = await getBlockedUserIds(session.user.id);
    if (blockedIds.includes(post.author.id)) {
      return NextResponse.json(
        { error: "Você não pode comentar neste post" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { content, parentId } = createCommentSchema.parse(body);

    // Se respondendo a um comentário, validar o pai
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

      // Impedir respostas aninhadas (apenas um nível de aninhamento permitido)
      if (parentComment.parentId !== null) {
        return NextResponse.json(
          { error: "Não é possível responder a uma resposta" },
          { status: 400 }
        );
      }
    }

    // Buscar info do usuário atual e preferências de notificação
    const notifyTargetId = parentId && parentComment
      ? parentComment.author.id
      : post.author.id;

    const [currentUser, notifyTarget] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      }),
      notifyTargetId !== session.user.id
        ? prisma.user.findUnique({
            where: { id: notifyTargetId },
            select: { notifyCommentReplied: true, notifyPostCommented: true },
          })
        : null,
    ]);

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

    // Criar notificação (respeitando preferências do usuário)
    if (parentId && parentComment) {
      // Notificar autor do comentário pai sobre a resposta (não para si mesmo, se habilitado)
      if (parentComment.author.id !== session.user.id && notifyTarget?.notifyCommentReplied) {
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
      // Notificar autor do post sobre o comentário (não para si mesmo, se habilitado)
      if (post.author.id !== session.user.id && notifyTarget?.notifyPostCommented) {
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

    // Retornar comentário transformado
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
    return handleZodError(error) ?? internalError("Erro ao criar comentário", error);
  }
}
