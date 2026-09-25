import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError, getBlockedUserIds } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { assertDateOrder, dateStringSchema, externalHttpUrlSchema } from "@/lib/validation";
import { getTeamPermissions } from "@/lib/team-permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateEventSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    location: z.string().trim().min(1).max(200).optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional().nullable(),
    type: z.enum(["COMPETITION", "TRYOUT", "CAMP", "WORKSHOP", "SHOWCASE", "OTHER"]).optional(),
    registrationUrl: externalHttpUrlSchema.optional().nullable(),
  });

// GET /api/events/[id] - Buscar evento específico
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

     const { id } = await params;
     const blockedIds = await getBlockedUserIds(session.user.id);

     const event = await prisma.event.findUnique({
       where: { id },
       include: {
        creator: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
    });

     if (!event) {
       return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
     }
     if (event.creatorId && blockedIds.includes(event.creatorId)) {
       return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
     }

     const isCreator = event.creatorId === session.user.id;
    let permissions = {
      canEdit: isCreator,
      canDelete: isCreator,
    };
    if (event.teamId && !isCreator) {
      const member = await prisma.teamMember.findFirst({
        where: { teamId: event.teamId, userId: session.user.id, isActive: true },
      });
      const teamPermissions = getTeamPermissions(member);
      permissions = {
        canEdit: teamPermissions.canEdit,
        canDelete: teamPermissions.canDeleteTeam,
      };
    }

    return NextResponse.json({ event, isCreator, permissions });
  } catch (error) {
    return internalError("Erro ao buscar evento", error);
  }
}

// PATCH /api/events/[id] - Atualizar evento
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;

    const event = await prisma.event.findUnique({
      where: { id },
      select: { creatorId: true, teamId: true, startDate: true, endDate: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
    }

    // Verificar se o usuário é o criador ou membro com permissão na equipe
    let canEdit = event.creatorId === session.user.id;

    if (!canEdit && event.teamId) {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          teamId: event.teamId,
          userId: session.user.id,
          isActive: true,
           canEdit: true,

        },
      });
      canEdit = getTeamPermissions(teamMember).canEdit;
    }

    if (!canEdit) {
      return NextResponse.json(
        { error: "Você não tem permissão para editar este evento" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = updateEventSchema.parse(body);
    try {
      assertDateOrder(
        data.startDate ?? event.startDate,
        data.endDate === undefined ? event.endDate : data.endDate
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Datas inválidas" },
        { status: 400 }
      );
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
    });

    return NextResponse.json({ event: updatedEvent });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao atualizar evento", error);
  }
}

// DELETE /api/events/[id] - Excluir evento
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;

    const event = await prisma.event.findUnique({
      where: { id },
      select: { creatorId: true, teamId: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
    }

    // Verificar se o usuário é o criador ou membro com permissão na equipe
    let canDelete = event.creatorId === session.user.id;

    if (!canDelete && event.teamId) {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          teamId: event.teamId,
          userId: session.user.id,
          isActive: true,
          OR: [{ canDeleteTeam: true }, { isAdmin: true }],
        },
      });
      canDelete = getTeamPermissions(teamMember).canDeleteTeam;
    }

    if (!canDelete) {
      return NextResponse.json(
        { error: "Você não tem permissão para excluir este evento" },
        { status: 403 }
      );
    }

    await prisma.event.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError("Erro ao excluir evento", error);
  }
}
