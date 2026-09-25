import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError, getConnectedUserIds, getBlockedUserIds, parsePaginationLimit } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { dateStringSchema } from "@/lib/validation";

const achievementSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório").max(150),
  description: z.string().trim().max(2000).optional().nullable(),
  date: dateStringSchema,
  category: z.string().trim().max(100).optional().nullable(),
});

// GET /api/achievements - Buscar conquistas do usuário
export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
     const userId = searchParams.get("userId") || session.user.id;
     const blockedIds = await getBlockedUserIds(session.user.id);
     const cursor = searchParams.get("cursor");
     const limit = parsePaginationLimit(searchParams, 10);

     if (blockedIds.includes(userId)) {
       return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
     }

     // Authorization: if viewing another user's achievements, check visibility
    if (userId !== session.user.id) {
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { profileVisibility: true },
      });

      if (!targetUser) {
        return NextResponse.json(
          { error: "Usuário não encontrado" },
          { status: 404 }
        );
      }

      if (targetUser.profileVisibility !== "PUBLIC") {
        const connectedIds = await getConnectedUserIds(session.user.id);
        if (!connectedIds.includes(userId)) {
          return NextResponse.json(
            { error: "Você não tem permissão para ver as conquistas deste usuário" },
            { status: 403 }
          );
        }
      }
    }

     const achievements = await prisma.achievement.findMany({
       where: { userId },
       orderBy: [{ date: "desc" }, { id: "desc" }],
       take: limit + 1,
       ...(cursor && { skip: 1, cursor: { id: cursor } }),
     });
     const hasMore = achievements.length > limit;
     const pageAchievements = hasMore ? achievements.slice(0, limit) : achievements;

     return NextResponse.json({
       achievements: pageAchievements,
       nextCursor: hasMore ? pageAchievements[pageAchievements.length - 1]?.id ?? null : null,
     });
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
