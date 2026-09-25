import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError, getBlockedUserIds } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getTeamPermissions } from "@/lib/team-permissions";
import { extractHashtags, extractMentions } from "@/lib/parsers";
import { publishRealtimeEvent } from "@/lib/realtime-bus";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

const createPostSchema = z.object({
  content: z.string().min(1, "Conteúdo é obrigatório"),
});

// POST /api/teams/[slug]/posts - Criar um post para a equipe
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { slug } = await params;

    // Verificar se o usuário tem permissão para postar pela equipe
    const team = await prisma.team.findUnique({
      where: { slug },
      include: {
        members: {
          where: {
            userId: session.user.id,
            isActive: true,
             canPost: true,

          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    }

    if (!getTeamPermissions(team.members[0]).canPost) {
      return NextResponse.json(
        { error: "Você não tem permissão para postar nesta equipe" },
        { status: 403 }
      );
    }

    const body = await request.json();
     const data = createPostSchema.parse(body);
     const blockedUserIds = await getBlockedUserIds(session.user.id);

    const post = await prisma.post.create({
      data: {
        content: data.content,
        authorId: session.user.id,
        teamId: team.id,
      },
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
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

     const hashtags = extractHashtags(data.content);
     const mentionUsernames = extractMentions(data.content);
     const mentionedUserIds: string[] = [];
     if (hashtags.length > 0 || mentionUsernames.length > 0) {
       await prisma.$transaction(async (tx) => {
         for (const tagName of hashtags) {
           const tag = await tx.tag.upsert({ where: { name: tagName }, update: {}, create: { name: tagName } });
           await tx.postTag.create({ data: { postId: post.id, tagId: tag.id } });
         }
         if (mentionUsernames.length > 0) {
           const mentionedUsers = await tx.user.findMany({
             where: { username: { in: mentionUsernames }, id: { notIn: blockedUserIds } },
             select: { id: true, username: true, notifyMention: true },
           });
           for (const mentionedUser of mentionedUsers) {
             await tx.mention.create({ data: { postId: post.id, mentionedUserId: mentionedUser.id } });
             mentionedUserIds.push(mentionedUser.id);
             if (mentionedUser.id !== session.user.id && mentionedUser.notifyMention) {
               await tx.notification.create({
                 data: {
                   userId: mentionedUser.id,
                   type: "MENTION",
                   message: `${post.author.name ?? post.author.username ?? "Alguém"} mencionou você em uma publicação`,
                   actorId: session.user.id,
                   relatedId: post.id,
                   relatedType: "post",
                 },
               });
             }
           }
         }
       });
       for (const userId of mentionedUserIds) {
         publishRealtimeEvent({ userId, type: "notification" });
       }
     }

     return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao criar post da equipe", error);
  }
}
