import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

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

    // Montar cláusula where baseada no filtro
    // TODO: For better search performance, consider adding PostgreSQL tsvector full-text search indexes
    const conditions: Record<string, unknown>[] = [];

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
