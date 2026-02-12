import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
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
    const tagName = decodeURIComponent(name).toLowerCase();

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "20");

    const tag = await prisma.tag.findUnique({
      where: { name: tagName },
      select: { id: true },
    });

    if (!tag) {
      return NextResponse.json({ posts: [], nextCursor: null });
    }

    // Fetch blocked user IDs (bidirectional)
    const [blockedByMe, blockedMe] = await Promise.all([
      prisma.block.findMany({ where: { userId: session.user.id }, select: { blockedUserId: true } }),
      prisma.block.findMany({ where: { blockedUserId: session.user.id }, select: { userId: true } }),
    ]);
    const blockedIds = [...blockedByMe.map(b => b.blockedUserId), ...blockedMe.map(b => b.userId)];

    const posts = await prisma.post.findMany({
      where: {
        tags: { some: { tagId: tag.id } },
        ...(blockedIds.length > 0 && { authorId: { notIn: blockedIds } }),
      },
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
    return internalError("Erro ao buscar posts por tag", error);
  }
}
