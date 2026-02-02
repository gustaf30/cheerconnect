import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET /api/teams/[slug]/follow - Check if user follows this team
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { slug } = await params;

    const team = await prisma.team.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    }

    const follow = await prisma.teamFollow.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId: team.id,
        },
      },
    });

    return NextResponse.json({ isFollowing: !!follow });
  } catch (error) {
    console.error("Check follow error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST /api/teams/[slug]/follow - Follow a team
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { slug } = await params;

    const team = await prisma.team.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    }

    // Check if already following
    const existingFollow = await prisma.teamFollow.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId: team.id,
        },
      },
    });

    if (existingFollow) {
      return NextResponse.json({ error: "Você já segue esta equipe" }, { status: 400 });
    }

    await prisma.teamFollow.create({
      data: {
        userId: session.user.id,
        teamId: team.id,
      },
    });

    return NextResponse.json({ success: true, isFollowing: true });
  } catch (error) {
    console.error("Follow team error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[slug]/follow - Unfollow a team
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { slug } = await params;

    const team = await prisma.team.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    }

    await prisma.teamFollow.deleteMany({
      where: {
        userId: session.user.id,
        teamId: team.id,
      },
    });

    return NextResponse.json({ success: true, isFollowing: false });
  } catch (error) {
    console.error("Unfollow team error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
