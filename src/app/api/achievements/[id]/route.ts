import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const updateAchievementSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  date: z.string().transform((str) => new Date(str)).optional(),
  category: z.string().optional().nullable(),
});

// PATCH /api/achievements/[id] - Atualizar conquista
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;

    // Verificar propriedade
    const existing = await prisma.achievement.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Conquista não encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data = updateAchievementSchema.parse(body);

    const achievement = await prisma.achievement.update({
      where: { id },
      data,
    });

    return NextResponse.json({ achievement });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao atualizar conquista", error);
  }
}

// DELETE /api/achievements/[id] - Excluir conquista
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;

    // Verificar propriedade
    const existing = await prisma.achievement.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Conquista não encontrada" },
        { status: 404 }
      );
    }

    await prisma.achievement.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError("Erro ao excluir conquista", error);
  }
}
