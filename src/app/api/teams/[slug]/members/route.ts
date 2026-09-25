import { NextResponse } from "next/server";
import { requireAuth, internalError, parsePaginationLimit, getBlockedUserIds } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getTeamPermissions } from "@/lib/team-permissions";

// GET /api/teams/[slug]/members - Listar membros da equipe
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;
    const { slug } = await params;

    const team = await prisma.team.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    }

    const { searchParams } = new URL(_request.url);
    const cursor = searchParams.get("cursor");
     const limit = parsePaginationLimit(searchParams, 50, 100);
     const [blockedIds, currentUserMember] = await Promise.all([
       getBlockedUserIds(session.user.id),
       prisma.teamMember.findFirst({
         where: { teamId: team.id, userId: session.user.id, isActive: true },
       }),
     ]);

     const members = await prisma.teamMember.findMany({
      where: {
         teamId: team.id,
         isActive: true,
         userId: { notIn: blockedIds },
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
       orderBy: [{ isAdmin: "desc" }, { hasPermission: "desc" }, { joinedAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });

    const hasMore = members.length > limit;
    const pageMembers = hasMore ? members.slice(0, limit) : members;

    // Verificar se o usuário atual tem permissão/admin
     const currentUserMemberForResponse = currentUserMember;

    // Remove flags admin/permissão dos dados para requisições não autenticadas
    const responseMembers = session
      ? pageMembers
      : pageMembers.map(({ isAdmin: _a, hasPermission: _p, ...member }) => member);

    return NextResponse.json({
      members: responseMembers,
       permissions: getTeamPermissions(currentUserMemberForResponse),
       isAdmin: currentUserMemberForResponse?.isAdmin ?? false,
       hasPermission: currentUserMemberForResponse?.hasPermission ?? false,
      nextCursor: hasMore ? pageMembers[pageMembers.length - 1]?.id ?? null : null,
    });
  } catch (error) {
    return internalError("Erro ao listar membros", error);
  }
}
