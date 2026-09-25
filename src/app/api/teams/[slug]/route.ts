import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError, getBlockedUserIds } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";
import { externalHttpUrlSchema } from "@/lib/validation";
import { deleteTeamMediaAssets } from "@/lib/media-assets";
import { isCloudinaryUrl } from "@/lib/media-url";
import { MediaPurpose } from "@prisma/client";

const teamMediaUrlSchema = z.string().url().refine(isCloudinaryUrl, "URL de asset inválida");

const updateTeamSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  category: z.enum(["ALLSTAR", "SCHOOL", "COLLEGE", "RECREATIONAL", "PROFESSIONAL"]).optional(),
  level: z.string().optional().nullable(),
  website: externalHttpUrlSchema.optional().nullable().or(z.literal("")),
  instagram: z.string().optional().nullable(),
  logo: teamMediaUrlSchema.optional().nullable(),
  banner: teamMediaUrlSchema.optional().nullable(),
});

// GET /api/teams/[slug] - Buscar detalhes da equipe
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;
     const { slug } = await params;
     const blockedIds = await getBlockedUserIds(session.user.id);

     const team = await prisma.team.findUnique({
      where: { slug },
      include: {
        members: {
           where: { isActive: true, userId: { notIn: blockedIds } },
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
          take: 20, // Paginated endpoint at /api/teams/[slug]/members for full list
        },
         posts: {
           where: { authorId: { notIn: blockedIds } },
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
             creatorId: { notIn: blockedIds },
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
            canEdit: true,
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

    const mediaUrls = [
      ...(data.logo ? [{ url: data.logo, purpose: MediaPurpose.TEAM_LOGO }] : []),
      ...(data.banner ? [{ url: data.banner, purpose: MediaPurpose.TEAM_BANNER }] : []),
    ];
    if (mediaUrls.length > 0) {
      const ownedAssets = await prisma.mediaAsset.findMany({
        where: {
          ownerId: session.user.id,
          teamId: team.id,
          status: "COMPLETED",
          OR: mediaUrls.map(({ url }) => ({ url })),
        },
        select: { url: true, purpose: true },
      });
      if (ownedAssets.length !== mediaUrls.length) {
        return NextResponse.json(
          { error: "Um ou mais arquivos não pertencem a esta equipe" },
          { status: 403 }
        );
      }
    }

    const updatedTeam = await prisma.team.update({
      where: { id: team.id },
      data: {
        ...data,
        website: data.website || null,
      },
    });

    logActivity({
      action: "TEAM_EDITED",
      entityType: "team",
      entityId: team.id,
      actorId: session.user.id,
      metadata: {
        teamSlug: slug,
        changes: data,
      },
    });

    return NextResponse.json({ team: updatedTeam });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao atualizar equipe", error);
  }
}

// DELETE /api/teams/[slug] - Excluir equipe (apenas admin)
export async function DELETE(
  _request: Request,
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

    await deleteTeamMediaAssets(team.id);

    await prisma.team.delete({
      where: { id: team.id },
    });

    logActivity({
      action: "TEAM_DELETED",
      entityType: "team",
      entityId: team.id,
      actorId: session.user.id,
      metadata: {
        teamSlug: slug,
        teamName: team.name,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError("Erro ao excluir equipe", error);
  }
}
