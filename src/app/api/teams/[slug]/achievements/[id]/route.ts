import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ slug: string; id: string }>;
}

// DELETE /api/teams/[slug]/achievements/[id] - Excluir conquista da equipe
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { slug, id } = await params;

    // Verificar se o usuário tem permissão na equipe
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
        { error: "Você não tem permissão para remover conquistas" },
        { status: 403 }
      );
    }

    // Verificar se a conquista pertence a esta equipe
    const achievement = await prisma.teamAchievement.findFirst({
      where: {
        id,
        teamId: team.id,
      },
    });

    if (!achievement) {
      return NextResponse.json({ error: "Conquista não encontrada" }, { status: 404 });
    }

    await prisma.teamAchievement.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError("Erro ao excluir conquista da equipe", error);
  }
}
