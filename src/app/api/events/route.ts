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
  registrationUrl: z.string().url().optional().nullable(),
});

const eventSelect = {
  id: true,
  name: true,
  description: true,
  location: true,
  startDate: true,
  endDate: true,
  type: true,
  registrationUrl: true,
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
} as const;

// GET /api/events - Buscar próximos eventos
export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "suggestions") {
      return handleEventSuggestions(session.user.id);
    }

    const type = searchParams.get("type");
    const q = searchParams.get("q")?.slice(0, 200);
    const location = searchParams.get("location");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
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
      select: eventSelect,
    });

    return NextResponse.json({
      events,
      nextCursor: events.length === limit ? events[events.length - 1]?.id : null,
    }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    return internalError("Erro ao buscar eventos", error);
  }
}

async function handleEventSuggestions(userId: string) {
  const MAX = 12;
  const now = new Date();

  // Get user info and team memberships in parallel
  const [currentUser, myMemberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { location: true },
    }),
    prisma.teamMember.findMany({
      where: { userId, isActive: true },
      select: { teamId: true },
    }),
  ]);

  const myTeamIds = myMemberships.map((m) => m.teamId);
  const seen = new Set<string>();
  const results: Array<Record<string, unknown>> = [];

  const add = (events: Array<Record<string, unknown>>) => {
    for (const e of events) {
      const id = e.id as string;
      if (!seen.has(id) && results.length < MAX) {
        seen.add(id);
        results.push(e);
      }
    }
  };

  // Events from user's teams
  const teamEventsPromise = myTeamIds.length > 0
    ? prisma.event.findMany({
        where: {
          teamId: { in: myTeamIds },
          startDate: { gte: now },
        },
        take: 5,
        orderBy: { startDate: "asc" },
        select: eventSelect,
      })
    : Promise.resolve([]);

  // Same region events
  const locationParts = currentUser?.location
    ?.split(",")
    .map((p) => p.trim())
    .filter(Boolean) || [];
  const statePart = locationParts[locationParts.length - 1];

  const regionEventsPromise = statePart
    ? prisma.event.findMany({
        where: {
          startDate: { gte: now },
          location: { contains: statePart, mode: "insensitive" },
        },
        take: 8,
        orderBy: { startDate: "asc" },
        select: eventSelect,
      })
    : Promise.resolve([]);

  // Upcoming events (fallback)
  const upcomingPromise = prisma.event.findMany({
    where: { startDate: { gte: now } },
    take: MAX,
    orderBy: { startDate: "asc" },
    select: eventSelect,
  });

  const [teamEvents, regionEvents, upcoming] = await Promise.all([
    teamEventsPromise,
    regionEventsPromise,
    upcomingPromise,
  ]);

  add(teamEvents);
  add(regionEvents);
  add(upcoming);

  return NextResponse.json({ events: results, nextCursor: null });
}

// POST /api/events - Criar novo evento
export async function POST(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const data = createEventSchema.parse(body);

    // Verify user has permission to create events for this team
    if (data.teamId) {
      const membership = await prisma.teamMember.findFirst({
        where: {
          teamId: data.teamId,
          userId: session.user.id,
          isActive: true,
          OR: [{ hasPermission: true }, { isAdmin: true }],
        },
      });
      if (!membership) {
        return NextResponse.json(
          { error: "Você não tem permissão para criar eventos para esta equipe" },
          { status: 403 }
        );
      }
    }

    const event = await prisma.event.create({
      data: {
        name: data.name,
        description: data.description,
        location: data.location,
        startDate: data.startDate,
        endDate: data.endDate || null,
        type: data.type,
        registrationUrl: data.registrationUrl || null,
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
