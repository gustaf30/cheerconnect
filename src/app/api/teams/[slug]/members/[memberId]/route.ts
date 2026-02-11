import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const updateMemberSchema = z.object({
  role: z.string().optional(),
  hasPermission: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
});

// PATCH /api/teams/[slug]/members/[memberId] - Atualizar papel/permissões do membro
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { slug, memberId } = await params;

    // Buscar equipe com o membro atual do usuário
    const team = await prisma.team.findUnique({
      where: { slug },
      include: {
        members: {
          where: {
            userId: session.user.id,
            isActive: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    }

    const currentUserMember = team.members[0];

    // Verificar se o usuário atual tem permissão
    if (!currentUserMember?.hasPermission) {
      return NextResponse.json(
        { error: "Você não tem permissão para gerenciar membros" },
        { status: 403 }
      );
    }

    // Encontrar o membro a ser atualizado
    const memberToUpdate = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!memberToUpdate || memberToUpdate.teamId !== team.id) {
      return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const data = updateMemberSchema.parse(body);

    // Se tentando atualizar próprias permissões (não apenas papel), bloquear
    // Bloquear apenas se os valores de permissão estão realmente mudando
    if (memberToUpdate.userId === session.user.id) {
      const permissionChanged = data.hasPermission !== undefined &&
        data.hasPermission !== memberToUpdate.hasPermission;
      const adminChanged = data.isAdmin !== undefined &&
        data.isAdmin !== memberToUpdate.isAdmin;

      if (permissionChanged || adminChanged) {
        return NextResponse.json(
          { error: "Você não pode alterar suas próprias permissões" },
          { status: 400 }
        );
      }
    }

    // Se o membro alvo é admin, apenas outro admin pode modificá-lo
    if (memberToUpdate.isAdmin && !currentUserMember.isAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem gerenciar outros administradores" },
        { status: 403 }
      );
    }

    // Se atualizando permissões de alguém com hasPermission, precisa ser isAdmin
    if (memberToUpdate.hasPermission && !currentUserMember.isAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem gerenciar membros com permissão" },
        { status: 403 }
      );
    }

    // Apenas admins podem conceder hasPermission ou isAdmin
    if ((data.hasPermission || data.isAdmin) && !currentUserMember.isAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem conceder permissões especiais" },
        { status: 403 }
      );
    }

    // Usar transação para prevenir condição de corrida ao remover último admin
    const updatedMember = await prisma.$transaction(async (tx) => {
      if (data.isAdmin === false && memberToUpdate.isAdmin) {
        const adminCount = await tx.teamMember.count({
          where: {
            teamId: team.id,
            isActive: true,
            isAdmin: true,
          },
        });

        if (adminCount <= 1) {
          throw new Error("LAST_ADMIN");
        }
      }

      return tx.teamMember.update({
        where: { id: memberId },
        data: {
          ...(data.role !== undefined && { role: data.role }),
          ...(data.hasPermission !== undefined && { hasPermission: data.hasPermission }),
          ...(data.isAdmin !== undefined && { isAdmin: data.isAdmin }),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
              positions: true,
            },
          },
        },
      });
    });

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "LAST_ADMIN") {
      return NextResponse.json(
        { error: "A equipe deve ter pelo menos um administrador" },
        { status: 400 }
      );
    }

    return internalError("Erro ao atualizar membro", error);
  }
}

// DELETE /api/teams/[slug]/members/[memberId] - Remover membro da equipe
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { slug, memberId } = await params;

    // Buscar equipe com o membro atual do usuário
    const team = await prisma.team.findUnique({
      where: { slug },
      include: {
        members: {
          where: {
            userId: session.user.id,
            isActive: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    }

    const currentUserMember = team.members[0];

    // Verificar se o usuário atual tem permissão
    if (!currentUserMember?.hasPermission) {
      return NextResponse.json(
        { error: "Você não tem permissão para remover membros" },
        { status: 403 }
      );
    }

    // Encontrar o membro a ser removido
    const memberToRemove = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!memberToRemove || memberToRemove.teamId !== team.id) {
      return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
    }

    // Não pode remover a si mesmo
    if (memberToRemove.userId === session.user.id) {
      return NextResponse.json(
        { error: "Você não pode se remover da equipe" },
        { status: 400 }
      );
    }

    // Se o membro alvo é admin, apenas outro admin pode removê-lo
    if (memberToRemove.isAdmin && !currentUserMember.isAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem remover outros administradores" },
        { status: 403 }
      );
    }

    // Se removendo alguém com hasPermission, precisa ser isAdmin
    if (memberToRemove.hasPermission && !currentUserMember.isAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem remover membros com permissão" },
        { status: 403 }
      );
    }

    // Usar transação para prevenir condição de corrida ao remover último admin
    await prisma.$transaction(async (tx) => {
      if (memberToRemove.isAdmin) {
        const adminCount = await tx.teamMember.count({
          where: {
            teamId: team.id,
            isActive: true,
            isAdmin: true,
          },
        });

        if (adminCount <= 1) {
          throw new Error("LAST_ADMIN");
        }
      }

      // Soft delete - marcar como inativo
      await tx.teamMember.update({
        where: { id: memberId },
        data: {
          isActive: false,
          leftAt: new Date(),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_ADMIN") {
      return NextResponse.json(
        { error: "Não é possível remover o último administrador da equipe" },
        { status: 400 }
      );
    }

    return internalError("Erro ao remover membro", error);
  }
}
