import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/users/me/teams - Get teams the current user is a member of
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
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
    console.error("Get user teams error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
