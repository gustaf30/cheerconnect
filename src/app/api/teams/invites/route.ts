import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET /api/teams/invites - Buscar convites pendentes do usuário atual
export async function GET() {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

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
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    return internalError("Erro ao buscar convites do usuário", error);
  }
}
