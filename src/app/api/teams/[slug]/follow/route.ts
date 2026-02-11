import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET /api/teams/[slug]/follow - Verificar se o usuário segue esta equipe
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

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
    return internalError("Erro ao verificar follow", error);
  }
}

// POST /api/teams/[slug]/follow - Seguir uma equipe
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { slug } = await params;

    const team = await prisma.team.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    }

    // Verificar se já está seguindo
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
    return internalError("Erro ao seguir equipe", error);
  }
}

// DELETE /api/teams/[slug]/follow - Deixar de seguir uma equipe
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

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
    return internalError("Erro ao deixar de seguir equipe", error);
  }
}
