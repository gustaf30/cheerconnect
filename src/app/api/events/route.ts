import { NextResponse } from "next/server";
import { z } from "zod";
import { EventType, Prisma } from "@prisma/client";
import { requireAuth, handleZodError, internalError, parsePaginationLimit, getBlockedUserIds } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { assertDateOrder, dateStringSchema, externalHttpUrlSchema } from "@/lib/validation";
import { getTeamPermissions } from "@/lib/team-permissions";

const createEventSchema = z
  .object({
    name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(150),
    description: z.string().trim().max(5000).optional().nullable(),
    location: z.string().trim().min(1, "Localização é obrigatória").max(200),
    startDate: dateStringSchema,
    endDate: dateStringSchema.optional().nullable(),
    type: z.enum(["COMPETITION", "TRYOUT", "CAMP", "WORKSHOP", "SHOWCASE", "OTHER"]),
    teamId: z.string().optional().nullable(),
    registrationUrl: externalHttpUrlSchema.optional().nullable(),
  })
  .superRefine((data, context) => {
    try {
      assertDateOrder(data.startDate, data.endDate);
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: error instanceof Error ? error.message : "Datas inválidas",
      });
    }
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
     const blockedIds = await getBlockedUserIds(session.user.id);

    if (mode === "suggestions") {
       return handleEventSuggestions(session.user.id, blockedIds);
    }

    const q = searchParams.get("q")?.slice(0, 200);
    const location = searchParams.get("location");
    const scope = searchParams.get("scope") || "upcoming";
    if (!["upcoming", "past", "all"].includes(scope)) {
      return NextResponse.json({ error: "Escopo de eventos inválido" }, { status: 400 });
    }
    const type = searchParams.get("type");
    if (type && !Object.values(EventType).includes(type as EventType)) {
      return NextResponse.json({ error: "Tipo de evento inválido" }, { status: 400 });
    }
    const limit = parsePaginationLimit(searchParams);
    const cursor = searchParams.get("cursor");
    const now = new Date();

    const locationParts = location
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean) || [];

    const dateFilters: Prisma.EventWhereInput[] = [];
     if (scope === "past") {
       dateFilters.push({
         OR: [
           { endDate: { lt: now } },
           { endDate: null, startDate: { lt: now } },
         ],
       });
     } else if (scope === "upcoming") {
       dateFilters.push({
         OR: [
           { endDate: { gte: now } },
           { endDate: null, startDate: { gte: now } },
         ],
       });
     }

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from) {
      const parsed = dateStringSchema.safeParse(from);
      if (!parsed.success) {
        return NextResponse.json({ error: "Data inicial inválida" }, { status: 400 });
      }
       dateFilters.push({
         OR: [
           { startDate: { gte: parsed.data } },
           { startDate: { lt: parsed.data }, endDate: { gte: parsed.data } },
         ],
       });
    }
    if (to) {
      const parsed = dateStringSchema.safeParse(to);
      if (!parsed.success) {
        return NextResponse.json({ error: "Data final inválida" }, { status: 400 });
      }
       dateFilters.push({
         OR: [
           { endDate: { lte: parsed.data } },
           { endDate: null, startDate: { lte: parsed.data } },
         ],
       });
    }
    if (from && to && new Date(from) > new Date(to)) {
      return NextResponse.json({ error: "A data inicial deve ser anterior à final" }, { status: 400 });
    }

    const filters: Prisma.EventWhereInput[] = [...dateFilters];
    if (type) filters.push({ type: type as EventType });
    if (q) {
      filters.push({
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    if (locationParts.length > 0) {
      filters.push({
        OR: locationParts.map((part) => ({
          location: { contains: part, mode: "insensitive" },
        })),
      });
    }

     if (blockedIds.length > 0) filters.push({ creatorId: { notIn: blockedIds } });

     const orderBy = scope === "past"
      ? [{ startDate: "desc" as const }, { id: "desc" as const }]
      : [{ startDate: "asc" as const }, { id: "asc" as const }];
    const events = await prisma.event.findMany({
      where: filters.length > 0 ? { AND: filters } : {},
      take: limit + 1,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy,
      select: eventSelect,
    });

    const hasMore = events.length > limit;
    const data = hasMore ? events.slice(0, limit) : events;
    return NextResponse.json({
      events: data,
      nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return internalError("Erro ao buscar eventos", error);
  }
}

async function handleEventSuggestions(userId: string, blockedIds: string[]) {
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
           creatorId: { notIn: blockedIds },
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
           creatorId: { notIn: blockedIds },
           location: { contains: statePart, mode: "insensitive" },
        },
        take: 8,
        orderBy: { startDate: "asc" },
        select: eventSelect,
      })
    : Promise.resolve([]);

  // Upcoming events (fallback)
  const upcomingPromise = prisma.event.findMany({
     where: { startDate: { gte: now }, creatorId: { notIn: blockedIds } },
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

  return NextResponse.json(
    { events: results, nextCursor: null },
    { headers: { "Cache-Control": "private, no-store" } }
  );
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
           canPost: true,

        },
      });
      if (!getTeamPermissions(membership).canPost) {
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
