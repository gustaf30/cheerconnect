import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
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

// GET /api/events/[id] - Get single event
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

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
    console.error("Get event error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// PATCH /api/events/[id] - Update event
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const event = await prisma.event.findUnique({
      where: { id },
      select: { creatorId: true, teamId: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
    }

    // Check if user is the creator or team admin
    let canEdit = event.creatorId === session.user.id;

    if (!canEdit && event.teamId) {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          teamId: event.teamId,
          userId: session.user.id,
          isActive: true,
          role: { in: ["OWNER", "ADMIN"] },
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Update event error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[id] - Delete event
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const event = await prisma.event.findUnique({
      where: { id },
      select: { creatorId: true, teamId: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
    }

    // Check if user is the creator or team admin
    let canDelete = event.creatorId === session.user.id;

    if (!canDelete && event.teamId) {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          teamId: event.teamId,
          userId: session.user.id,
          isActive: true,
          role: { in: ["OWNER", "ADMIN"] },
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
    console.error("Delete event error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
