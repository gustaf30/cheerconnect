import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ slug: string; id: string }>;
}

// DELETE /api/teams/[slug]/achievements/[id] - Delete team achievement
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { slug, id } = await params;

    // Check if user is admin of this team
    const team = await prisma.team.findUnique({
      where: { slug },
      include: {
        members: {
          where: {
            userId: session.user.id,
            isActive: true,
            role: { in: ["OWNER", "ADMIN"] },
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    }

    if (team.members.length === 0) {
      return NextResponse.json(
        { error: "Você não tem permissão para remover conquistas" },
        { status: 403 }
      );
    }

    // Check if achievement belongs to this team
    const achievement = await prisma.teamAchievement.findFirst({
      where: {
        id,
        teamId: team.id,
      },
    });

    if (!achievement) {
      return NextResponse.json({ error: "Conquista não encontrada" }, { status: 404 });
    }

    await prisma.teamAchievement.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete team achievement error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
