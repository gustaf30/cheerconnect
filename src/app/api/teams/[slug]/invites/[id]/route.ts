import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// DELETE /api/teams/[slug]/invites/[id] - Cancelar convite
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { slug, id } = await params;

    // Verificar se o usuário é OWNER ou ADMIN da equipe
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
        { error: "Você não tem permissão para cancelar convites" },
        { status: 403 }
      );
    }

    // Encontrar o convite
    const invite = await prisma.teamInvite.findUnique({
      where: { id },
    });

    if (!invite || invite.teamId !== team.id) {
      return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
    }

    // Excluir o convite
    await prisma.teamInvite.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError("Erro ao cancelar convite", error);
  }
}
