import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const achievementSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional().nullable(),
  date: z.string().transform((str) => new Date(str)),
  category: z.string().optional().nullable(),
});

// GET /api/achievements - Get user's achievements
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

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
    console.error("Get achievements error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST /api/achievements - Add achievement
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Create achievement error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
