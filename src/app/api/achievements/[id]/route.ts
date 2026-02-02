import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateAchievementSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  date: z.string().transform((str) => new Date(str)).optional(),
  category: z.string().optional().nullable(),
});

// PATCH /api/achievements/[id] - Update achievement
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Update achievement error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/achievements/[id] - Delete achievement
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
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
    console.error("Delete achievement error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
