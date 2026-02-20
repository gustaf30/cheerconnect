import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError, parsePaginationLimit } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { Position } from "@prisma/client";

const positionEnum = z.enum(["FLYER", "BASE", "BACKSPOT", "FRONTSPOT", "TUMBLER", "COACH", "CHOREOGRAPHER", "JUDGE", "OTHER"]);

const careerSchema = z.object({
  role: z.enum(["ATHLETE", "COACH", "ASSISTANT_COACH", "CHOREOGRAPHER", "TEAM_MANAGER", "JUDGE", "OTHER"]),
  positions: z.array(positionEnum).max(10).default([]),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)).optional().nullable(),
  isCurrent: z.boolean().default(false),
  teamName: z.string().min(1, "Nome do time é obrigatório"),
  teamId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
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
      ],
      take: limit,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });

    const nextCursor = careerHistory.length === limit ? careerHistory[careerHistory.length - 1]?.id : null;

    return NextResponse.json({ careerHistory, nextCursor });
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
