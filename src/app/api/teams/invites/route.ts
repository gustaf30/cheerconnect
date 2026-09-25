import { NextResponse } from "next/server";
import { requireAuth, internalError, parsePaginationLimit } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET /api/teams/invites - Buscar convites pendentes do usuário atual
export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parsePaginationLimit(searchParams);

    const invites = await prisma.teamInvite.findMany({
      where: {
        userId: session.user.id,
        status: "PENDING",
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
       orderBy: [{ createdAt: "desc" }, { id: "desc" }],
       take: limit + 1,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });

     const hasMore = invites.length > limit;
     const pageInvites = hasMore ? invites.slice(0, limit) : invites;

     return NextResponse.json({
       invites: pageInvites,
       nextCursor: hasMore ? pageInvites[pageInvites.length - 1]?.id ?? null : null,
     });
  } catch (error) {
    return internalError("Erro ao buscar convites do usuário", error);
  }
}
