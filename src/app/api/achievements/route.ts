import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const achievementSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional().nullable(),
  date: z.string().transform((str) => new Date(str)),
  category: z.string().optional().nullable(),
});

// GET /api/achievements - Buscar conquistas do usuário
export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || session.user.id;
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "10");

    const achievements = await prisma.achievement.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: limit,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });

    const nextCursor = achievements.length === limit ? achievements[achievements.length - 1]?.id : null;

    return NextResponse.json({ achievements, nextCursor });
  } catch (error) {
    return internalError("Erro ao buscar conquistas", error);
  }
}

// POST /api/achievements - Adicionar conquista
export async function POST(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const data = achievementSchema.parse(body);

    const achievement = await prisma.achievement.create({
      data: {
        ...data,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ achievement }, { status: 201 });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao criar conquista", error);
  }
}
