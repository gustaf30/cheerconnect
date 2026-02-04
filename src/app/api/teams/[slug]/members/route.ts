import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/teams/[slug]/members - List team members
export async function GET(
  request: Request,
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

    // Check if current user has permission/admin status
    const currentUserMember = session?.user?.id
      ? members.find((m) => m.userId === session.user.id)
      : null;

    return NextResponse.json({
      members,
      isAdmin: currentUserMember?.isAdmin ?? false,
      hasPermission: currentUserMember?.hasPermission ?? false,
    });
  } catch (error) {
    console.error("List members error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
