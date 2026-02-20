import { NextResponse } from "next/server";
import { requireAuth, internalError, getBlockedUserIds, getConnectedUserIds } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { Position } from "@prisma/client";

const userSelect = {
  id: true,
  name: true,
  username: true,
  avatar: true,
  bio: true,
  location: true,
  positions: true,
  experience: true,
} as const;

// GET /api/users - Buscar usuários
export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "suggestions") {
      return handleSuggestions(session.user.id);
    }

    const query = searchParams.get("q")?.slice(0, 200) || "";
    const position = searchParams.get("position");
    const location = searchParams.get("location");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const cursor = searchParams.get("cursor");

    // Buscar IDs de usuários conectados e bloqueados em paralelo
    const [connectedUserIds, blockedIds] = await Promise.all([
      getConnectedUserIds(session.user.id),
      getBlockedUserIds(session.user.id),
    ]);

    // NOTE: Full-text search (PostgreSQL tsvector) would improve performance here — deferred to post-launch.
    const users = await prisma.user.findMany({
      where: {
        id: { not: session.user.id },
        AND: [
          // Block filtering
          ...(blockedIds.length > 0 ? [{ id: { notIn: blockedIds } }] : []),
          // Filtro de visibilidade do perfil
          {
            OR: [
              { profileVisibility: "PUBLIC" },
              { id: { in: connectedUserIds } },
            ],
          },
          query
            ? {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { username: { contains: query, mode: "insensitive" } },
                ],
              }
            : {},
          position ? { positions: { has: position as Position } } : {},
          location
            ? { location: { contains: location, mode: "insensitive" } }
            : {},
        ],
      },
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: { name: "asc" },
      select: userSelect,
    });

    return NextResponse.json({
      users,
      nextCursor: users.length === limit ? users[users.length - 1]?.id : null,
    }, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    return internalError("Erro ao buscar usuários", error);
  }
}

async function handleSuggestions(userId: string) {
  const MAX = 12;

  // Get current user info, connections, and blocked users in parallel
  const [currentUser, connectedIds, blockedIds] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { positions: true, location: true },
    }),
    getConnectedUserIds(userId),
    getBlockedUserIds(userId),
  ]);

  const excludeIds = [userId, ...connectedIds, ...blockedIds];
  const seen = new Set<string>();
  const results: Array<Record<string, unknown>> = [];

  const add = (users: Array<Record<string, unknown>>) => {
    for (const u of users) {
      const id = u.id as string;
      if (!seen.has(id) && results.length < MAX) {
        seen.add(id);
        results.push(u);
      }
    }
  };

  // 2nd-degree connections: connections of my connections
  const secondDegreePromise = connectedIds.length > 0
    ? prisma.connection.findMany({
        where: {
          status: "ACCEPTED",
          OR: [
            { senderId: { in: connectedIds }, receiverId: { notIn: excludeIds } },
            { receiverId: { in: connectedIds }, senderId: { notIn: excludeIds } },
          ],
        },
        select: { senderId: true, receiverId: true },
        take: 20,
      }).then(async (conns) => {
        const ids = [...new Set(conns.map((c) =>
          connectedIds.includes(c.senderId) ? c.receiverId : c.senderId
        ))].slice(0, 6);
        if (ids.length === 0) return [];
        return prisma.user.findMany({
          where: { id: { in: ids }, profileVisibility: "PUBLIC" },
          select: userSelect,
        });
      })
    : Promise.resolve([]);

  // Same positions
  const positionsPromise = currentUser?.positions?.length
    ? prisma.user.findMany({
        where: {
          id: { notIn: excludeIds },
          profileVisibility: "PUBLIC",
          positions: { hasSome: currentUser.positions },
        },
        take: 8,
        orderBy: { createdAt: "desc" },
        select: userSelect,
      })
    : Promise.resolve([]);

  // Same region (state part of location)
  const locationParts = currentUser?.location
    ?.split(",")
    .map((p) => p.trim())
    .filter(Boolean) || [];
  const statePart = locationParts[locationParts.length - 1];

  const regionPromise = statePart
    ? prisma.user.findMany({
        where: {
          id: { notIn: excludeIds },
          profileVisibility: "PUBLIC",
          location: { contains: statePart, mode: "insensitive" },
        },
        take: 10,
        orderBy: { createdAt: "desc" },
        select: userSelect,
      })
    : Promise.resolve([]);

  // Fallback: recent users (any visibility — suggestions show only basic info)
  const fallbackPromise = prisma.user.findMany({
    where: {
      id: { notIn: excludeIds },
    },
    take: MAX,
    orderBy: { createdAt: "desc" },
    select: userSelect,
  });

  const [secondDegree, samePositions, sameRegion, fallback] = await Promise.all([
    secondDegreePromise,
    positionsPromise,
    regionPromise,
    fallbackPromise,
  ]);

  add(secondDegree);
  add(samePositions);
  add(sameRegion);
  add(fallback);

  return NextResponse.json({ users: results, nextCursor: null });
}
