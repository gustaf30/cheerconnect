import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError, parsePaginationLimit } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";

const createInviteSchema = z.object({
  userId: z.string(),
  role: z.string().default("Atleta"),
  hasPermission: z.boolean().default(false),
  isAdmin: z.boolean().default(false),
});

// POST /api/teams/[slug]/invites - Enviar convite para usuário
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { slug } = await params;

    // Verificar se o usuário tem permissão para convidar membros
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

    // Validar e sanitizar role
    if (role && (typeof role !== "string" || role.length > 50)) {
      return NextResponse.json(
        { error: "O cargo deve ter no máximo 50 caracteres" },
        { status: 400 }
      );
    }
    const sanitizedRole = role ? role.replace(/<[^>]*>/g, "").trim() : role;

    // Apenas admins podem convidar com permissões elevadas
    const currentMember = team.members[0];
    if (isAdmin && !currentMember.isAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem conceder privilégios de administrador" },
        { status: 403 }
      );
    }
    if (hasPermission && !currentMember.isAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem conceder permissões especiais" },
        { status: 403 }
      );
    }

    // Verificar se o usuário existe e obter preferências de notificação
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, notifyTeamInvite: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Verificar se o usuário já é membro
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

    // Verificar se existe convite pendente
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

    // Criar ou atualizar convite
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
        role: sanitizedRole,
        hasPermission,
        isAdmin,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
      },
      update: {
        role: sanitizedRole,
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

    // Criar notificação para o usuário convidado (se habilitado)
    if (targetUser.notifyTeamInvite) {
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
    }

    logActivity({
      action: "INVITE_SENT",
      entityType: "team_invite",
      entityId: invite.id,
      actorId: session.user.id,
      metadata: {
        teamSlug: slug,
        teamId: team.id,
        invitedUserId: userId,
        invitedUserName: targetUser.name,
        role: sanitizedRole,
        hasPermission,
        isAdmin,
      },
    });

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao criar convite", error);
  }
}

// GET /api/teams/[slug]/invites - Listar convites pendentes
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { slug } = await params;

    // Verificar se o usuário tem permissão para ver convites
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

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parsePaginationLimit(searchParams);

    const invites = await prisma.teamInvite.findMany({
      where: {
        teamId: team.id,
        status: "PENDING",
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
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
      take: limit,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });

    const nextCursor = invites.length === limit ? invites[invites.length - 1]?.id : null;

    return NextResponse.json({ invites, nextCursor });
  } catch (error) {
    return internalError("Erro ao listar convites", error);
  }
}
