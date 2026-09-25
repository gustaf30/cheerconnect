import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError, getBlockedUserIds, getConnectedUserIds, parsePaginationLimit } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { extractHashtags, extractMentions } from "@/lib/parsers";
import { linkPostMediaAssets } from "@/lib/media-assets";
import { isHttpUrl } from "@/lib/validation";

const CLOUDINARY_URL_PREFIX = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`;
const cloudinaryUrl = z
  .string()
  .url("URL inválida")
  .refine(isHttpUrl, "URL deve usar http ou https")
  .refine(
    (url) => url.startsWith(CLOUDINARY_URL_PREFIX),
    "URL deve ser do Cloudinary"
  );

const createPostSchema = z
  .object({
    content: z.string().min(1, "Conteúdo é obrigatório").max(5000),
    images: z.array(cloudinaryUrl).max(4).refine((images) => new Set(images).size === images.length, "Arquivos duplicados não são permitidos").optional(),
    videoUrl: cloudinaryUrl.optional(),
    teamId: z.string().optional(),
  })
  .superRefine((data, context) => {
    if (data.images && data.images.length > 0 && data.videoUrl) {
      context.addIssue({
        code: "custom",
        path: ["videoUrl"],
        message: "Não é possível enviar imagens e vídeo no mesmo post",
      });
    }
  });

// GET /api/posts - Buscar posts do feed
export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parsePaginationLimit(searchParams);
    const filter = searchParams.get("filter") || "following";
    if (!["following", "all"].includes(filter)) {
      return NextResponse.json({ error: "Filtro de feed inválido" }, { status: 400 });
    }
    const query = searchParams.get("q")?.slice(0, 200);
    const tag = searchParams.get("tag")?.replace(/^#/, "").slice(0, 200);

    const blockedIds = await getBlockedUserIds(session.user.id);

    // Montar cláusula where baseada no filtro
    // NOTA: Full-text search (PostgreSQL tsvector) melhoraria performance aqui — adiado para pós-lançamento.
    const conditions: Record<string, unknown>[] = [];

    // Excluir posts de usuários bloqueados
    if (blockedIds.length > 0) {
      conditions.push({ authorId: { notIn: blockedIds } });
    }

    if (tag) {
      conditions.push({ tags: { some: { tag: { name: tag.toLowerCase() } } } });
    } else if (query) {
      conditions.push({ content: { contains: query, mode: "insensitive" } });
    }

    if (filter === "following") {
      // Buscar conexões e equipes seguidas em paralelo (evita N+1 sequencial)
      const [connectionIds, followedTeams] = await Promise.all([
        getConnectedUserIds(session.user.id),
        prisma.teamFollow.findMany({
          where: { userId: session.user.id },
          select: { teamId: true },
        }),
      ]);

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
      take: limit + 1,
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
          select: {
            id: true,
            content: true,
            images: true,
            videoUrl: true,
            createdAt: true,
            isEdited: true,
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
            reposts: {
              where: { authorId: session.user.id },
              select: { id: true },
              take: 1,
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
          take: 1,
        },
        reposts: {
          where: { authorId: session.user.id },
          select: { id: true },
          take: 1,
        },
      },
    });

    const formattedPosts = posts.map((post) => ({
      ...post,
      isLiked: post.likes.length > 0,
      hasReposted: (post.reposts?.length ?? 0) > 0,
      likes: undefined,
      reposts: undefined,
      originalPost:
        post.originalPost && !blockedIds.includes(post.originalPost.author.id)
          ? {
              ...post.originalPost,
              isLiked: post.originalPost.likes.length > 0,
              hasReposted: (post.originalPost.reposts?.length ?? 0) > 0,
              likes: undefined,
              reposts: undefined,
            }
          : null,
    }));

    const hasMore = posts.length > limit;
    const pagePosts = hasMore ? posts.slice(0, limit) : posts;
    const pageFormattedPosts = formattedPosts.slice(0, limit);
    return NextResponse.json({
      posts: pageFormattedPosts,
      nextCursor: hasMore ? pagePosts[pagePosts.length - 1]?.id ?? null : null,
    }, {
      headers: { "Cache-Control": "private, no-store" },
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
    const blockedUserIds = await getBlockedUserIds(session.user.id);

    // Verificar se o usuário tem permissão para postar pela equipe
    if (teamId) {
      const membership = await prisma.teamMember.findFirst({
        where: { userId: session.user.id, teamId, isActive: true, canPost: true },
      });
      if (!membership) {
        return NextResponse.json(
          { error: "Você não tem permissão para postar nesta equipe" },
          { status: 403 }
        );
      }
    }

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

    try {
      await linkPostMediaAssets(
        post.id,
        session.user.id,
        [...(images || []), ...(videoUrl ? [videoUrl] : [])]
      );
    } catch (mediaError) {
      await prisma.post.delete({ where: { id: post.id } }).catch(() => undefined);
      if (mediaError instanceof Error) {
        return NextResponse.json({ error: mediaError.message }, { status: 400 });
      }
      throw mediaError;
    }

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
            where: {
              username: { in: mentionUsernames },
              id: { notIn: blockedUserIds },
            },
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
                  message: `${post.author.name ?? post.author.username ?? "Alguém"} mencionou você em uma publicação`,
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
