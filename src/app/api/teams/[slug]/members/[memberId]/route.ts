import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateMemberSchema = z.object({
  role: z.string().optional(),
  hasPermission: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
});

// PATCH /api/teams/[slug]/members/[memberId] - Update member role/permissions
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { slug, memberId } = await params;

    // Get team with current user's membership
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

    // Check if current user has permission
    if (!currentUserMember?.hasPermission) {
      return NextResponse.json(
        { error: "Você não tem permissão para gerenciar membros" },
        { status: 403 }
      );
    }

    // Find the member to update
    const memberToUpdate = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!memberToUpdate || memberToUpdate.teamId !== team.id) {
      return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const data = updateMemberSchema.parse(body);

    // If trying to update own permissions (not just role), block it
    // Only block if the permission values are actually changing
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

    // If updating permissions of someone with hasPermission, need isAdmin
    if (memberToUpdate.hasPermission && !currentUserMember.isAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem gerenciar membros com permissão" },
        { status: 403 }
      );
    }

    // Only admins can grant hasPermission or isAdmin
    if ((data.hasPermission || data.isAdmin) && !currentUserMember.isAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem conceder permissões especiais" },
        { status: 403 }
      );
    }

    // If removing isAdmin, check if it's not the last admin
    if (data.isAdmin === false && memberToUpdate.isAdmin) {
      const adminCount = await prisma.teamMember.count({
        where: {
          teamId: team.id,
          isActive: true,
          isAdmin: true,
        },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "A equipe deve ter pelo menos um administrador" },
          { status: 400 }
        );
      }
    }

    const updatedMember = await prisma.teamMember.update({
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

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Update member error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[slug]/members/[memberId] - Remove member from team
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { slug, memberId } = await params;

    // Get team with current user's membership
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

    // Check if current user has permission
    if (!currentUserMember?.hasPermission) {
      return NextResponse.json(
        { error: "Você não tem permissão para remover membros" },
        { status: 403 }
      );
    }

    // Find the member to remove
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

    // Cannot remove yourself
    if (memberToRemove.userId === session.user.id) {
      return NextResponse.json(
        { error: "Você não pode se remover da equipe" },
        { status: 400 }
      );
    }

    // If removing someone with hasPermission, need isAdmin
    if (memberToRemove.hasPermission && !currentUserMember.isAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem remover membros com permissão" },
        { status: 403 }
      );
    }

    // Cannot remove if it's the last admin
    if (memberToRemove.isAdmin) {
      const adminCount = await prisma.teamMember.count({
        where: {
          teamId: team.id,
          isActive: true,
          isAdmin: true,
        },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Não é possível remover o último administrador da equipe" },
          { status: 400 }
        );
      }
    }

    // Soft delete - mark as inactive
    await prisma.teamMember.update({
      where: { id: memberId },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
