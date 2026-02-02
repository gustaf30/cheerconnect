import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
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

// GET /api/teams/[slug]/achievements - Get team achievements
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

    const achievements = await prisma.teamAchievement.findMany({
      where: { teamId: team.id },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ achievements });
  } catch (error) {
    console.error("Get team achievements error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST /api/teams/[slug]/achievements - Create team achievement
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { slug } = await params;

    // Check if user is admin of this team
    const team = await prisma.team.findUnique({
      where: { slug },
      include: {
        members: {
          where: {
            userId: session.user.id,
            isActive: true,
            role: { in: ["OWNER", "ADMIN"] },
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Create team achievement error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
