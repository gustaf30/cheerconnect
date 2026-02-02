import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createPostSchema = z.object({
  content: z.string().min(1, "Conteúdo é obrigatório").max(5000),
  images: z.array(z.string()).optional(),
  teamId: z.string().optional(),
});

// GET /api/posts - Get feed posts
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Get user's connections
    const connections = await prisma.connection.findMany({
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
    });

    const connectionIds = connections.map((c) =>
      c.senderId === session.user.id ? c.receiverId : c.senderId
    );

    // Get user's followed teams
    const followedTeams = await prisma.teamFollow.findMany({
      where: { userId: session.user.id },
      select: { teamId: true },
    });

    const followedTeamIds = followedTeams.map((f) => f.teamId);

    // Include own posts, connections' posts, and followed teams' posts
    const authorIds = [session.user.id, ...connectionIds];

    const posts = await prisma.post.findMany({
      where: {
        OR: [
          { authorId: { in: authorIds } },
          { teamId: { in: followedTeamIds } },
        ],
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
        _count: {
          select: {
            likes: true,
            comments: true,
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
    }));

    return NextResponse.json({
      posts: formattedPosts,
      nextCursor: posts.length === limit ? posts[posts.length - 1]?.id : null,
    });
  } catch (error) {
    console.error("Get posts error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST /api/posts - Create a new post
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { content, images, teamId } = createPostSchema.parse(body);

    const post = await prisma.post.create({
      data: {
        content,
        images: images || [],
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
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Create post error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
