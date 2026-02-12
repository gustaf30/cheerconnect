import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { extractHashtags, extractMentions } from "@/lib/parsers";

const createPostSchema = z.object({
  content: z.string().min(1, "Conteúdo é obrigatório").max(5000),
  images: z.array(z.string().url("URL de imagem inválida")).max(4).optional(),
  videoUrl: z.string().url("URL de vídeo inválida").optional(),
  teamId: z.string().optional(),
});

// GET /api/posts - Buscar posts do feed
export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "20");
    const filter = searchParams.get("filter") || "following";
    const query = searchParams.get("q");

    // Fetch blocked user IDs (bidirectional)
    const [blockedByMe, blockedMe] = await Promise.all([
      prisma.block.findMany({ where: { userId: session.user.id }, select: { blockedUserId: true } }),
      prisma.block.findMany({ where: { blockedUserId: session.user.id }, select: { userId: true } }),
    ]);
    const blockedIds = [...blockedByMe.map(b => b.blockedUserId), ...blockedMe.map(b => b.userId)];

    // Montar cláusula where baseada no filtro
    // TODO: For better search performance, consider adding PostgreSQL tsvector full-text search indexes
    const conditions: Record<string, unknown>[] = [];

    // Exclude posts from blocked users
    if (blockedIds.length > 0) {
      conditions.push({ authorId: { notIn: blockedIds } });
    }

    // Text search filter (post content)
    if (query) {
      conditions.push({ content: { contains: query, mode: "insensitive" } });
    }

    if (filter === "following") {
      // Buscar conexões e equipes seguidas em paralelo (evita N+1 sequencial)
      const [connections, followedTeams] = await Promise.all([
        prisma.connection.findMany({
          where: {
            status: "ACCEPTED",
            OR: [
              { senderId: session.user.id },
              { receiverId: session.user.id },
            ],
          },
          select: {
            senderId: true,
            receiverId: true,
          },
        }),
        prisma.teamFollow.findMany({
          where: { userId: session.user.id },
          select: { teamId: true },
        }),
      ]);

      const connectionIds = connections.map((c) =>
        c.senderId === session.user.id ? c.receiverId : c.senderId
      );
      const followedTeamIds = followedTeams.map((f) => f.teamId);

      // Incluir posts próprios, das conexões e das equipes seguidas
      const authorIds = [session.user.id, ...connectionIds];

      conditions.push({
        OR: [
          { authorId: { in: authorIds } },
          { teamId: { in: followedTeamIds } },
        ],
      });
    }
    // Se filter === "all", sem filtro de autor (todos os posts)

    const whereClause = conditions.length > 0 ? { AND: conditions } : {};

    const posts = await prisma.post.findMany({
      where: whereClause,
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: { createdAt: "desc" },
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
            likes: {
              where: { userId: session.user.id },
              select: { id: true },
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
        likes: {
          where: { userId: session.user.id },
          select: { id: true },
        },
      },
    });

    const formattedPosts = posts.map((post) => ({
      ...post,
      isLiked: post.likes.length > 0,
      likes: undefined,
      originalPost: post.originalPost
        ? {
            ...post.originalPost,
            isLiked: post.originalPost.likes.length > 0,
            likes: undefined,
          }
        : null,
    }));

    return NextResponse.json({
      posts: formattedPosts,
      nextCursor: posts.length === limit ? posts[posts.length - 1]?.id : null,
    });
  } catch (error) {
    return internalError("Erro ao buscar posts", error);
  }
}

// POST /api/posts - Criar um novo post
export async function POST(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const { content, images, videoUrl, teamId } = createPostSchema.parse(body);

    const post = await prisma.post.create({
      data: {
        content,
        images: images || [],
        videoUrl,
        authorId: session.user.id,
        teamId,
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
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    // Processar hashtags e menções do conteúdo
    const hashtags = extractHashtags(content);
    const mentionUsernames = extractMentions(content);

    if (hashtags.length > 0 || mentionUsernames.length > 0) {
      await prisma.$transaction(async (tx) => {
        // Upsert tags e criar PostTag
        for (const tagName of hashtags) {
          const tag = await tx.tag.upsert({
            where: { name: tagName },
            update: {},
            create: { name: tagName },
          });
          await tx.postTag.create({
            data: { postId: post.id, tagId: tag.id },
          });
        }

        // Processar menções
        if (mentionUsernames.length > 0) {
          const mentionedUsers = await tx.user.findMany({
            where: { username: { in: mentionUsernames } },
            select: { id: true, username: true, notifyMention: true },
          });

          for (const mentionedUser of mentionedUsers) {
            await tx.mention.create({
              data: { postId: post.id, mentionedUserId: mentionedUser.id },
            });

            // Notificar mencionado (não notificar a si mesmo)
            if (mentionedUser.id !== session.user.id && mentionedUser.notifyMention) {
              await tx.notification.create({
                data: {
                  userId: mentionedUser.id,
                  type: "MENTION",
                  message: `${post.author.name} mencionou você em uma publicação`,
                  actorId: session.user.id,
                  relatedId: post.id,
                  relatedType: "post",
                },
              });
            }
          }
        }
      });
    }

    return NextResponse.json({
      post: {
        ...post,
        isLiked: false,
      },
    });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao criar post", error);
  }
}
