import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth, handleZodError, internalError, parsePaginationLimit, getBlockedUserIds } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { externalHttpUrlSchema } from "@/lib/validation";
import { normalizeTeamPermissions } from "@/lib/team-permissions";

const createTeamSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  category: z.enum(["ALLSTAR", "SCHOOL", "COLLEGE", "RECREATIONAL", "PROFESSIONAL"]).default("ALLSTAR"),
  level: z.string().optional().nullable(),
  website: externalHttpUrlSchema.optional().nullable().or(z.literal("")),
  instagram: z.string().optional().nullable(),
});

const teamSelect = {
  id: true,
  name: true,
  slug: true,
  logo: true,
  location: true,
  category: true,
  level: true,
  _count: {
    select: {
      members: {
        where: { isActive: true },
      },
    },
  },
} as const;

// GET /api/teams - Buscar lista de equipes
export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

     const { searchParams } = new URL(request.url);
     const mode = searchParams.get("mode");
     const blockedIds = await getBlockedUserIds(session.user.id);

    if (mode === "suggestions") {
       return handleTeamSuggestions(session.user.id, blockedIds);
    }

    const query = searchParams.get("q")?.slice(0, 200) || "";
    const category = searchParams.get("category");
    const parsedCategory = z.enum(["ALLSTAR", "SCHOOL", "COLLEGE", "RECREATIONAL", "PROFESSIONAL"]).safeParse(category || undefined);
    if (category && !parsedCategory.success) {
      return NextResponse.json({ error: "Categoria de equipe inválida" }, { status: 400 });
    }
    const location = searchParams.get("location");
    const limit = parsePaginationLimit(searchParams);
    const cursor = searchParams.get("cursor");

    // Separar localização em partes cidade/estado para busca OR
    // ex: "Ponta Grossa, Paraná" -> ["Ponta Grossa", "Paraná"]
    const locationParts = location
      ?.split(",")
      .map((p) => p.trim())
      .filter(Boolean) || [];

    // NOTA: Full-text search (PostgreSQL tsvector) melhoraria performance aqui — adiado para pós-lançamento.
    const teams = await prisma.team.findMany({
      where: {
        AND: [
          query
            ? {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { location: { contains: query, mode: "insensitive" } },
                ],
              }
            : {},
           parsedCategory.success ? { category: parsedCategory.data } : {},

          locationParts.length > 0
            ? {
                OR: locationParts.map((part) => ({
                  location: { contains: part, mode: "insensitive" as const },
                })),
              }
            : {},
        ],
      },
      take: limit + 1,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
       orderBy: [{ name: "asc" }, { id: "asc" }],
      select: teamSelect,
    });

    const hasMore = teams.length > limit;
    const pageTeams = hasMore ? teams.slice(0, limit) : teams;
    return NextResponse.json({
      teams: pageTeams,
      nextCursor: hasMore ? pageTeams[pageTeams.length - 1]?.id ?? null : null,
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return internalError("Erro ao buscar equipes", error);
  }
}

async function handleTeamSuggestions(userId: string, blockedIds: string[]) {
  const MAX = 12;

  // Buscar info do usuário, conexões e equipes próprias em paralelo
  const [currentUser, acceptedConnections, myMemberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { location: true },
    }),
    prisma.connection.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      select: { senderId: true, receiverId: true },
    }),
    prisma.teamMember.findMany({
      where: { userId, isActive: true },
      select: { teamId: true },
    }),
  ]);

  const connectedIds = acceptedConnections
    .map((c) => c.senderId === userId ? c.receiverId : c.senderId)
    .filter((id) => !blockedIds.includes(id));
  const myTeamIds = myMemberships.map((m) => m.teamId);
  const seen = new Set<string>();
  const results: Array<Record<string, unknown>> = [];

  const add = (teams: Array<Record<string, unknown>>) => {
    for (const t of teams) {
      const id = t.id as string;
      if (!seen.has(id) && results.length < MAX) {
        seen.add(id);
        results.push(t);
      }
    }
  };

  // Equipes onde conexões são membros ativos (usuário NÃO é membro)
  const connectionTeamsPromise = connectedIds.length > 0
    ? prisma.team.findMany({
        where: {
          id: { notIn: myTeamIds },
          AND: [
            {
              members: {
                some: {
                  userId: { in: connectedIds },
                  isActive: true,
                },
              },
            },
            { members: { none: { userId: { in: blockedIds }, isActive: true } } },
          ],
        },
        take: 5,
        select: teamSelect,
      })
    : Promise.resolve([]);

  // Equipes da mesma região
  const locationParts = currentUser?.location
    ?.split(",")
    .map((p) => p.trim())
    .filter(Boolean) || [];
  const statePart = locationParts[locationParts.length - 1];

  const regionTeamsPromise = statePart
    ? prisma.team.findMany({
         where: {
           id: { notIn: myTeamIds },
           location: { contains: statePart, mode: "insensitive" },
           members: { none: { userId: { in: blockedIds }, isActive: true } },
         },
        take: 8,
        select: teamSelect,
      })
    : Promise.resolve([]);

  // Equipes populares (por número de membros)
  const popularTeamsPromise = prisma.team.findMany({
    where: {
      id: { notIn: myTeamIds },
      members: { none: { userId: { in: blockedIds }, isActive: true } },
    },
    take: MAX,
    orderBy: { members: { _count: "desc" } },
    select: teamSelect,
  });

  const [connectionTeams, regionTeams, popularTeams] = await Promise.all([
    connectionTeamsPromise,
    regionTeamsPromise,
    popularTeamsPromise,
  ]);

  add(connectionTeams);
  add(regionTeams);
  add(popularTeams);

  return NextResponse.json({ teams: results, nextCursor: null });
}

// POST /api/teams - Criar uma nova equipe
export async function POST(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const data = createTeamSchema.parse(body);

    // Gerar slug a partir do nome
    const baseSlug = data.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Cria com retry em conflito de slug — sem pre-check para evitar race condition
    let slug = baseSlug;
    let counter = 0;
    const MAX_RETRIES = 5;
    let team;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        team = await prisma.team.create({
          data: {
            ...data,
            slug,
            website: data.website || null,
            members: {
              create: {
                userId: session.user.id,
                role: "",
                ...normalizeTeamPermissions({ isAdmin: true }),
              },
            },
          },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            location: true,
            category: true,
            level: true,
          },
        });
        break;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          attempt < MAX_RETRIES
        ) {
          counter++;
          slug = `${baseSlug}-${counter}`;
          continue;
        }
        throw err;
      }
    }

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao criar equipe", error);
  }
}
