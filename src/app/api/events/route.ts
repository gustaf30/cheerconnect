import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createEventSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  description: z.string().optional().nullable(),
  location: z.string().min(1, "Localização é obrigatória"),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)).optional().nullable(),
  type: z.enum(["COMPETITION", "TRYOUT", "CAMP", "WORKSHOP", "SHOWCASE", "OTHER"]),
  teamId: z.string().optional().nullable(),
});

// GET /api/events - Buscar próximos eventos
export async function GET(request: Request) {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const q = searchParams.get("q");
    const location = searchParams.get("location");
    const limit = parseInt(searchParams.get("limit") || "20");
    const cursor = searchParams.get("cursor");

    // Separar localização em partes de cidade/estado para busca OR
    // ex.: "Ponta Grossa, Paraná" → ["Ponta Grossa", "Paraná"]
    const locationParts = location
      ?.split(",")
      .map((p) => p.trim())
      .filter(Boolean) || [];

    const events = await prisma.event.findMany({
      where: {
        startDate: { gte: new Date() },
        ...(type ? { type: type as never } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(locationParts.length > 0
          ? {
              OR: locationParts.map((part) => ({
                location: { contains: part, mode: "insensitive" as const },
              })),
            }
          : {}),
      },
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        location: true,
        startDate: true,
        endDate: true,
        type: true,
        creatorId: true,
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

    return NextResponse.json({
      events,
      nextCursor: events.length === limit ? events[events.length - 1]?.id : null,
    });
  } catch (error) {
    return internalError("Erro ao buscar eventos", error);
  }
}

// POST /api/events - Criar novo evento
export async function POST(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const data = createEventSchema.parse(body);

    const event = await prisma.event.create({
      data: {
        name: data.name,
        description: data.description,
        location: data.location,
        startDate: data.startDate,
        endDate: data.endDate || null,
        type: data.type,
        creatorId: session.user.id,
        teamId: data.teamId || null,
      },
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

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao criar evento", error);
  }
}
