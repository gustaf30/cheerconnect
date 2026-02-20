import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError, parsePaginationLimit } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

const achievementSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional().nullable(),
  date: z.string().transform((str) => new Date(str)),
  category: z.string().optional().nullable(),
});

// GET /api/teams/[slug]/achievements - Buscar conquistas da equipe
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const { slug } = await params;

    const team = await prisma.team.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parsePaginationLimit(searchParams, 10);

    const achievements = await prisma.teamAchievement.findMany({
      where: { teamId: team.id },
      orderBy: { date: "desc" },
      take: limit,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });

    const nextCursor = achievements.length === limit ? achievements[achievements.length - 1]?.id : null;

    return NextResponse.json({ achievements, nextCursor });
  } catch (error) {
    return internalError("Erro ao buscar conquistas da equipe", error);
  }
}

// POST /api/teams/[slug]/achievements - Criar conquista da equipe
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { slug } = await params;

    // Verificar se o usuário é admin da equipe
    const team = await prisma.team.findUnique({
      where: { slug },
      include: {
        members: {
          where: {
            userId: session.user.id,
            isActive: true,
            OR: [{ hasPermission: true }, { isAdmin: true }],
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    }

    if (team.members.length === 0) {
      return NextResponse.json(
        { error: "Você não tem permissão para adicionar conquistas" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = achievementSchema.parse(body);

    const achievement = await prisma.teamAchievement.create({
      data: {
        title: data.title,
        description: data.description,
        date: data.date,
        category: data.category,
        teamId: team.id,
      },
    });

    return NextResponse.json({ achievement }, { status: 201 });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao criar conquista da equipe", error);
  }
}
