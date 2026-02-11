import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { Position } from "@prisma/client";

const positionEnum = z.enum(["FLYER", "BASE", "BACKSPOT", "FRONTSPOT", "TUMBLER", "COACH", "CHOREOGRAPHER", "JUDGE", "OTHER"]);

const updateCareerSchema = z.object({
  role: z.enum(["ATHLETE", "COACH", "ASSISTANT_COACH", "CHOREOGRAPHER", "TEAM_MANAGER", "JUDGE", "OTHER"]).optional(),
  positions: z.array(positionEnum).max(10).optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional().nullable(),
  isCurrent: z.boolean().optional(),
  teamName: z.string().min(1).optional(),
  teamId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
});

// GET /api/career/[id] - Buscar experiência de carreira específica
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;

    const career = await prisma.careerHistory.findFirst({
      where: {
        id,
        userId: session.user.id,
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

    if (!career) {
      return NextResponse.json(
        { error: "Experiência não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ career });
  } catch (error) {
    return internalError("Erro ao buscar experiência de carreira", error);
  }
}

// PATCH /api/career/[id] - Atualizar experiência de carreira
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;

    // Verificar propriedade
    const existing = await prisma.careerHistory.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Experiência não encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateCareerSchema.parse(body);

    // Separar teamId para a sintaxe de atualização de relação do Prisma
    const { teamId, positions, ...restData } = parsed;

    const career = await prisma.careerHistory.update({
      where: { id },
      data: {
        ...restData,
        // Converter positions para Position[] do Prisma
        ...(positions !== undefined && { positions: positions as Position[] }),
        // Incluir atualização de relação team apenas se teamId foi explicitamente fornecido
        ...(teamId !== undefined && {
          team: teamId ? { connect: { id: teamId } } : { disconnect: true },
        }),
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

    return NextResponse.json({ career });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao atualizar experiência de carreira", error);
  }
}

// DELETE /api/career/[id] - Excluir experiência de carreira
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;

    // Verificar propriedade
    const existing = await prisma.careerHistory.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Experiência não encontrada" },
        { status: 404 }
      );
    }

    await prisma.careerHistory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError("Erro ao excluir experiência de carreira", error);
  }
}
