import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { Position } from "@prisma/client";

// GET /api/users - Buscar usuários
export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const position = searchParams.get("position");
    const location = searchParams.get("location");
    const limit = parseInt(searchParams.get("limit") || "20");
    const cursor = searchParams.get("cursor");

    // Buscar IDs de usuários com conexões aceitas com o usuário atual
    const acceptedConnections = await prisma.connection.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { senderId: session.user.id },
          { receiverId: session.user.id },
        ],
      },
      select: { senderId: true, receiverId: true },
    });

    const connectedUserIds = acceptedConnections.map((c) =>
      c.senderId === session.user.id ? c.receiverId : c.senderId
    );

    // TODO: For better search performance, consider adding PostgreSQL tsvector full-text search indexes
    const users = await prisma.user.findMany({
      where: {
        id: { not: session.user.id },
        AND: [
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
    return internalError("Erro ao buscar usuários", error);
  }
}
