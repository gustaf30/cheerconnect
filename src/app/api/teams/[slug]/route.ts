import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const updateTeamSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  category: z.enum(["ALLSTAR", "SCHOOL", "COLLEGE", "RECREATIONAL", "PROFESSIONAL"]).optional(),
  level: z.string().optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal("")),
  instagram: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  banner: z.string().optional().nullable(),
});

// GET /api/teams/[slug] - Buscar detalhes da equipe
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { slug } = await params;

    const team = await prisma.team.findUnique({
      where: { slug },
      include: {
        members: {
          where: { isActive: true },
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
        },
        posts: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            author: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
                positions: true,
              },
            },
            _count: {
              select: {
                likes: true,
                comments: true,
              },
            },
            likes: session?.user?.id
              ? {
                  where: { userId: session.user.id },
                  select: { id: true },
                }
              : false,
          },
        },
        events: {
          where: {
            startDate: { gte: new Date() },
          },
          orderBy: { startDate: "asc" },
          take: 5,
        },
        _count: {
          select: {
            members: { where: { isActive: true } },
            posts: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Equipe não encontrada" },
        { status: 404 }
      );
    }

    // Verificar se o usuário atual é membro
    const isMember = session?.user?.id
      ? team.members.some((m) => m.userId === session.user.id)
      : false;

    const posts = team.posts.map((post) => ({
      ...post,
      isLiked: Array.isArray(post.likes) && post.likes.length > 0,
      likes: undefined,
    }));

    return NextResponse.json({
      team: {
        ...team,
        posts,
        isMember,
      },
    });
  } catch (error) {
    return internalError("Erro ao buscar equipe", error);
  }
}

// PATCH /api/teams/[slug] - Atualizar equipe
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { slug } = await params;

    // Verificar se o usuário tem permissão para editar a equipe
    const team = await prisma.team.findUnique({
      where: { slug },
      include: {
        members: {
          where: {
            userId: session.user.id,
            isActive: true,
            hasPermission: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    }

    if (team.members.length === 0) {
      return NextResponse.json(
        { error: "Você não tem permissão para editar esta equipe" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = updateTeamSchema.parse(body);

    const updatedTeam = await prisma.team.update({
      where: { id: team.id },
      data: {
        ...data,
        website: data.website || null,
      },
    });

    return NextResponse.json({ team: updatedTeam });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao atualizar equipe", error);
  }
}

// DELETE /api/teams/[slug] - Excluir equipe (apenas admin)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { slug } = await params;

    // Verificar se o usuário é admin da equipe
    const team = await prisma.team.findUnique({
      where: { slug },
      include: {
        members: {
          where: {
            userId: session.user.id,
            isActive: true,
            isAdmin: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    }

    if (team.members.length === 0) {
      return NextResponse.json(
        { error: "Apenas administradores podem excluir a equipe" },
        { status: 403 }
      );
    }

    await prisma.team.delete({
      where: { id: team.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError("Erro ao excluir equipe", error);
  }
}
