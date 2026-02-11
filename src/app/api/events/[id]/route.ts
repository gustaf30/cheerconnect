import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateEventSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  location: z.string().min(1).optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional().nullable(),
  type: z.enum(["COMPETITION", "TRYOUT", "CAMP", "WORKSHOP", "SHOWCASE", "OTHER"]).optional(),
});

// GET /api/events/[id] - Buscar evento específico
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;

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

    const isCreator = event.creatorId === session.user.id;

    return NextResponse.json({ event, isCreator });
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
      select: { creatorId: true, teamId: true },
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
          OR: [{ hasPermission: true }, { isAdmin: true }],
        },
      });
      canEdit = !!teamMember;
    }

    if (!canEdit) {
      return NextResponse.json(
        { error: "Você não tem permissão para editar este evento" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = updateEventSchema.parse(body);

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
export async function DELETE(request: Request, { params }: RouteParams) {
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
          OR: [{ hasPermission: true }, { isAdmin: true }],
        },
      });
      canDelete = !!teamMember;
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
