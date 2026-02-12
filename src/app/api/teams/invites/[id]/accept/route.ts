import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";

// POST /api/teams/invites/[id]/accept - Aceitar convite
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;

    // Encontrar o convite
    const invite = await prisma.teamInvite.findUnique({
      where: { id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
    }

    // Verificar se o convite é para o usuário atual
    if (invite.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Este convite não é para você" },
        { status: 403 }
      );
    }

    // Verificar se o convite ainda está pendente
    if (invite.status !== "PENDING") {
      return NextResponse.json(
        { error: "Este convite não está mais pendente" },
        { status: 400 }
      );
    }

    // Verificar se o convite expirou
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      await prisma.teamInvite.update({
        where: { id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "Este convite expirou" },
        { status: 400 }
      );
    }

    // Usar transação para atualizar convite e criar/atualizar membro
    await prisma.$transaction(async (tx) => {
      // Atualizar status do convite
      await tx.teamInvite.update({
        where: { id },
        data: { status: "ACCEPTED" },
      });

      // Verificar se existe registro de membro inativo
      const existingMember = await tx.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId: session.user.id,
            teamId: invite.teamId,
          },
        },
      });

      if (existingMember) {
        // Reativar membro existente
        await tx.teamMember.update({
          where: { id: existingMember.id },
          data: {
            isActive: true,
            role: invite.role,
            hasPermission: invite.hasPermission,
            isAdmin: invite.isAdmin,
            joinedAt: new Date(),
            leftAt: null,
          },
        });
      } else {
        // Criar novo membro
        await tx.teamMember.create({
          data: {
            userId: session.user.id,
            teamId: invite.teamId,
            role: invite.role,
            hasPermission: invite.hasPermission,
            isAdmin: invite.isAdmin,
            isActive: true,
          },
        });
      }
    });

    logActivity({
      action: "INVITE_ACCEPTED",
      entityType: "team_invite",
      entityId: id,
      actorId: session.user.id,
      metadata: {
        teamId: invite.teamId,
        teamSlug: invite.team.slug,
        teamName: invite.team.name,
        role: invite.role,
      },
    });

    return NextResponse.json({
      success: true,
      team: invite.team,
    });
  } catch (error) {
    return internalError("Erro ao aceitar convite", error);
  }
}
