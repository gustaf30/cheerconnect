import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET /api/teams/[slug]/members - Listar membros da equipe
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { slug } = await params;

    const team = await prisma.team.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    }

    const members = await prisma.teamMember.findMany({
      where: {
        teamId: team.id,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            positions: true,
          },
        },
      },
      orderBy: [{ isAdmin: "desc" }, { hasPermission: "desc" }, { joinedAt: "asc" }],
    });

    // Verificar se o usuário atual tem permissão/admin
    const currentUserMember = session?.user?.id
      ? members.find((m) => m.userId === session.user.id)
      : null;

    return NextResponse.json({
      members,
      isAdmin: currentUserMember?.isAdmin ?? false,
      hasPermission: currentUserMember?.hasPermission ?? false,
    });
  } catch (error) {
    return internalError("Erro ao listar membros", error);
  }
}
