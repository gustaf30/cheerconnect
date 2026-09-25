import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/security-events";

export async function GET() {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const userId = session.user.id;
    const [
      profile,
      posts,
      comments,
      likes,
      commentLikes,
      career,
      achievements,
      memberships,
      connections,
      events,
      notifications,
      conversations,
      reports,
      requests,
      blocks,
      teamFollows,
      mediaAssets,
      activityLogs,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          avatar: true,
          banner: true,
          bio: true,
          location: true,
          birthDate: true,
          positions: true,
          experience: true,
          skills: true,
          profileVisibility: true,
          showEmail: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.post.findMany({ where: { authorId: userId }, orderBy: { createdAt: "desc" } }),
      prisma.comment.findMany({ where: { authorId: userId }, orderBy: { createdAt: "desc" } }),
      prisma.like.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.commentLike.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.careerHistory.findMany({ where: { userId }, orderBy: { startDate: "desc" } }),
      prisma.achievement.findMany({ where: { userId }, orderBy: { date: "desc" } }),
      prisma.teamMember.findMany({ where: { userId }, orderBy: { joinedAt: "desc" } }),
      prisma.connection.findMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
        orderBy: { createdAt: "desc" },
      }),
      prisma.event.findMany({ where: { creatorId: userId }, orderBy: { startDate: "desc" } }),
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.conversation.findMany({
        where: { OR: [{ participant1Id: userId }, { participant2Id: userId }] },
        select: {
          id: true,
          participant1Id: true,
          participant2Id: true,
          createdAt: true,
          messages: {
            where: { OR: [{ senderId: userId }, { senderId: { not: userId } }] },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.report.findMany({
        where: { OR: [{ reporterId: userId }, { moderatorId: userId }] },
        orderBy: { createdAt: "desc" },
      }),
      prisma.privacyRequest.findMany({ where: { userId }, orderBy: { requestedAt: "desc" } }),
      prisma.block.findMany({
        where: { OR: [{ userId }, { blockedUserId: userId }] },
        orderBy: { createdAt: "desc" },
      }),
      prisma.teamFollow.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.mediaAsset.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          url: true,
          publicId: true,
          purpose: true,
          resourceType: true,
          mimeType: true,
          bytes: true,
          width: true,
          height: true,
          status: true,
          postId: true,
          teamId: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      prisma.activityLog.findMany({ where: { actorId: userId }, orderBy: { createdAt: "desc" } }),
    ]);

    logSecurityEvent("privacy.export", { userId });
    const exportedAt = new Date();
    const data = {
      exportedAt: exportedAt.toISOString(),
      profile,
      posts,
      comments,
      likes,
      commentLikes,
      career,
      achievements,
      memberships,
      connections,
      events,
      notifications,
      conversations,
      reports,
      privacyRequests: requests,
      blocks,
      teamFollows,
      mediaAssets,
      activityLogs,
    };

    await prisma.privacyRequest.create({
      data: {
        userId,
        type: "EXPORT",
        status: "COMPLETED",
        completedAt: exportedAt,
        expiresAt: new Date(exportedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="cheerconnect-data-${userId}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return internalError("Erro ao exportar dados", error);
  }
}
