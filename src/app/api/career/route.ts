import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError, parsePaginationLimit } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { assertDateOrder, dateStringSchema } from "@/lib/validation";
import { Position } from "@prisma/client";

const positionEnum = z.enum(["FLYER", "BASE", "BACKSPOT", "FRONTSPOT", "TUMBLER", "COACH", "CHOREOGRAPHER", "JUDGE", "OTHER"]);

const careerSchema = z
  .object({
    role: z.enum(["ATHLETE", "COACH", "ASSISTANT_COACH", "CHOREOGRAPHER", "TEAM_MANAGER", "JUDGE", "OTHER"]),
    positions: z.array(positionEnum).max(10).default([]),
    startDate: dateStringSchema,
    endDate: dateStringSchema.optional().nullable(),
    isCurrent: z.boolean().default(false),
    teamName: z.string().trim().min(1, "Nome do time é obrigatório").max(150),
    teamId: z.string().optional().nullable(),
    description: z.string().trim().max(2000).optional().nullable(),
    location: z.string().trim().max(200).optional().nullable(),
  })
  .superRefine((data, context) => {
    try {
      assertDateOrder(data.startDate, data.endDate);
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: error instanceof Error ? error.message : "Datas inválidas",
      });
    }
    if (data.isCurrent && data.endDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Experiência atual não pode ter data de término",
      });
    }
  });

// GET /api/career - Buscar histórico de carreira do usuário
export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parsePaginationLimit(searchParams);

    const careerHistory = await prisma.careerHistory.findMany({
      where: { userId: session.user.id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
       orderBy: [
         { isCurrent: "desc" },
         { startDate: "desc" },
         { id: "desc" },
       ],
       take: limit + 1,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });

     const hasMore = careerHistory.length > limit;
     const pageCareerHistory = hasMore ? careerHistory.slice(0, limit) : careerHistory;

     return NextResponse.json({
       careerHistory: pageCareerHistory,
       nextCursor: hasMore ? pageCareerHistory[pageCareerHistory.length - 1]?.id ?? null : null,
     });
  } catch (error) {
    return internalError("Erro ao buscar carreira", error);
  }
}

// POST /api/career - Adicionar experiência de carreira
export async function POST(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const parsed = careerSchema.parse(body);

    // Separar teamId e positions para os tipos de relação/enum do Prisma
    const { teamId, positions, ...restData } = parsed;

    const career = await prisma.careerHistory.create({
      data: {
        ...restData,
        positions: positions as Position[],
        userId: session.user.id,
        ...(teamId && { teamId }),
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
    });

    return NextResponse.json({ career }, { status: 201 });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao criar experiência de carreira", error);
  }
}
