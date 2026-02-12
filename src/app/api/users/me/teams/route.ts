import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET /api/users/me/teams - Buscar equipes do usuário atual
export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.slice(0, 200) || "";
    const categoryFilter = searchParams.get("category") || "";
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "20");

    const teams = await prisma.team.findMany({
      where: {
        members: {
          some: {
            userId: session.user.id,
            isActive: true,
          },
        },
        AND: [
          query
            ? {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { location: { contains: query, mode: "insensitive" } },
                ],
              }
            : {},
          categoryFilter && categoryFilter.trim()
            ? { category: categoryFilter as never }
            : {},
        ],
      },
      orderBy: { name: "asc" },
      select: {
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
      },
      take: limit,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });

    const nextCursor = teams.length === limit ? teams[teams.length - 1]?.id : null;

    return NextResponse.json({ teams, nextCursor });
  } catch (error) {
    return internalError("Erro ao buscar equipes do usuário", error);
  }
}
