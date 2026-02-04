import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createInviteSchema = z.object({
  userId: z.string(),
  role: z.string().default("Atleta"),
  hasPermission: z.boolean().default(false),
  isAdmin: z.boolean().default(false),
});

// POST /api/teams/[slug]/invites - Send invite to user
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { slug } = await params;

    // Check if user has permission to invite members
    const team = await prisma.team.findUnique({
      where: { slug },
      include: {
        members: {
          where: {
            userId: session.user.id,
            isActive: true,
            hasPermission: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    }

    if (team.members.length === 0) {
      return NextResponse.json(
        { error: "Você não tem permissão para convidar membros" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, role, hasPermission, isAdmin } = createInviteSchema.parse(body);

    // Only admins can invite with admin permissions
    const currentMember = team.members[0];
    if ((hasPermission || isAdmin) && !currentMember.isAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem conceder permissões especiais" },
        { status: 403 }
      );
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Check if user is already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId: team.id,
        },
      },
    });

    if (existingMember?.isActive) {
      return NextResponse.json(
        { error: "Usuário já é membro desta equipe" },
        { status: 400 }
      );
    }

    // Check for existing pending invite
    const existingInvite = await prisma.teamInvite.findUnique({
      where: {
        teamId_userId: {
          teamId: team.id,
          userId,
        },
      },
    });

    if (existingInvite?.status === "PENDING") {
      return NextResponse.json(
        { error: "Já existe um convite pendente para este usuário" },
        { status: 400 }
      );
    }

    // Create or update invite
    const invite = await prisma.teamInvite.upsert({
      where: {
        teamId_userId: {
          teamId: team.id,
          userId,
        },
      },
      create: {
        teamId: team.id,
        userId,
        role,
        hasPermission,
        isAdmin,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      update: {
        role,
        hasPermission,
        isAdmin,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Create notification for the invited user
    await prisma.notification.create({
      data: {
        userId,
        type: "TEAM_INVITE",
        message: `Você foi convidado para a equipe ${team.name}`,
        actorId: session.user.id,
        relatedId: team.id,
        relatedType: "team",
      },
    });

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Create invite error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// GET /api/teams/[slug]/invites - List pending invites
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { slug } = await params;

    // Check if user has permission to view invites
    const team = await prisma.team.findUnique({
      where: { slug },
      include: {
        members: {
          where: {
            userId: session.user.id,
            isActive: true,
            hasPermission: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    }

    if (team.members.length === 0) {
      return NextResponse.json(
        { error: "Você não tem permissão para ver os convites" },
        { status: 403 }
      );
    }

    const invites = await prisma.teamInvite.findMany({
      where: {
        teamId: team.id,
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error("List invites error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
