import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/teams/invites/[id]/accept - Accept invite
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;

    // Find the invite
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

    // Check if the invite is for the current user
    if (invite.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Este convite não é para você" },
        { status: 403 }
      );
    }

    // Check if invite is still pending
    if (invite.status !== "PENDING") {
      return NextResponse.json(
        { error: "Este convite não está mais pendente" },
        { status: 400 }
      );
    }

    // Check if invite has expired
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

    // Use a transaction to update invite and create/update member
    await prisma.$transaction(async (tx) => {
      // Update invite status
      await tx.teamInvite.update({
        where: { id },
        data: { status: "ACCEPTED" },
      });

      // Check if there's an inactive member record
      const existingMember = await tx.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId: session.user.id,
            teamId: invite.teamId,
          },
        },
      });

      if (existingMember) {
        // Reactivate existing member
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
        // Create new member
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

    return NextResponse.json({
      success: true,
      team: invite.team,
    });
  } catch (error) {
    console.error("Accept invite error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
