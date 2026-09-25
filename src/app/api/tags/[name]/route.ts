import { NextResponse } from "next/server";
import { requireAuth, internalError, getBlockedUserIds, parsePaginationLimit } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET /api/tags/[name] - Buscar posts por tag
export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { name } = await params;
    let decodedName: string;
    try {
      decodedName = decodeURIComponent(name);
    } catch {
      return NextResponse.json({ error: "Nome de tag inválido" }, { status: 400 });
    }
    const tagName = decodedName.slice(0, 200).toLowerCase();

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parsePaginationLimit(searchParams);

    const tag = await prisma.tag.findUnique({
      where: { name: tagName },
      select: { id: true },
    });

    if (!tag) {
      return NextResponse.json({ posts: [], nextCursor: null });
    }

    const blockedIds = await getBlockedUserIds(session.user.id);

    const posts = await prisma.post.findMany({
      where: {
        tags: { some: { tagId: tag.id } },
        ...(blockedIds.length > 0 && { authorId: { notIn: blockedIds } }),
      },
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
    return NextResponse.json({
      posts: formattedPosts.slice(0, limit),
      nextCursor: hasMore ? pagePosts[pagePosts.length - 1]?.id ?? null : null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return internalError("Erro ao buscar posts por tag", error);
  }
}
