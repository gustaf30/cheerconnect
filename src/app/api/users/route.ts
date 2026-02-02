import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Position } from "@prisma/client";

// GET /api/users - Search users
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const position = searchParams.get("position");
    const location = searchParams.get("location");
    const limit = parseInt(searchParams.get("limit") || "20");
    const cursor = searchParams.get("cursor");

    const users = await prisma.user.findMany({
      where: {
        id: { not: session.user.id },
        AND: [
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
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        bio: true,
        location: true,
        positions: true,
        experience: true,
      },
    });

    return NextResponse.json({
      users,
      nextCursor: users.length === limit ? users[users.length - 1]?.id : null,
    });
  } catch (error) {
    console.error("Search users error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
