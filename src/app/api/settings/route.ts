import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const updateSettingsSchema = z.object({
  username: z
    .string()
    .min(3, "Username deve ter pelo menos 3 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Username pode conter apenas letras, números e _")
    .optional(),
  notifications: z
    .object({
      postLiked: z.boolean(),
      postCommented: z.boolean(),
      connectionRequest: z.boolean(),
      connectionAccepted: z.boolean(),
      commentReplied: z.boolean(),
      messageReceived: z.boolean(),
      mention: z.boolean(),
    })
    .partial()
    .optional(),
  privacy: z
    .object({
      profileVisibility: z.enum(["PUBLIC", "CONNECTIONS_ONLY"]),
      showEmail: z.boolean(),
    })
    .partial()
    .optional(),
});

// GET /api/settings - Buscar configurações do usuário atual
export async function GET() {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        username: true,
        notifyPostLiked: true,
        notifyPostCommented: true,
        notifyConnectionRequest: true,
        notifyConnectionAccepted: true,
        notifyCommentReplied: true,
        notifyMessageReceived: true,
        notifyMention: true,
        profileVisibility: true,
        showEmail: true,
        usernameChangedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    // Check password existence without fetching the hash
    const hasPassword = await prisma.user.count({
      where: { id: session.user.id, password: { not: null } },
    }) > 0;

    // Calcular disponibilidade de alteração do username
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const canChangeUsername = !user.usernameChangedAt ||
      (Date.now() - user.usernameChangedAt.getTime()) >= THIRTY_DAYS_MS;
    const nextUsernameChangeDate = user.usernameChangedAt
      ? new Date(user.usernameChangedAt.getTime() + THIRTY_DAYS_MS)
      : null;

    // Calcular dias até poder alterar o username
    const daysUntilUsernameChange = !canChangeUsername && nextUsernameChangeDate
      ? Math.ceil((nextUsernameChangeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    return NextResponse.json({
      settings: {
        email: user.email,
        username: user.username,
        hasPassword,
        notifications: {
          postLiked: user.notifyPostLiked,
          postCommented: user.notifyPostCommented,
          connectionRequest: user.notifyConnectionRequest,
          connectionAccepted: user.notifyConnectionAccepted,
          commentReplied: user.notifyCommentReplied,
          messageReceived: user.notifyMessageReceived,
          mention: user.notifyMention,
        },
        privacy: {
          profileVisibility: user.profileVisibility,
          showEmail: user.showEmail,
        },
        canChangeUsername,
        nextUsernameChangeDate,
        daysUntilUsernameChange,
      },
    });
  } catch (error) {
    return internalError("Erro ao buscar configurações", error);
  }
}

// PATCH /api/settings - Atualizar configurações do usuário atual
export async function PATCH(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const data = updateSettingsSchema.parse(body);

    // Montar dados de atualização
    const updateData: Record<string, unknown> = {};

    // Tratar alteração de username
    if (data.username !== undefined) {
      // Buscar dados atuais do usuário incluindo usernameChangedAt
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { username: true, usernameChangedAt: true },
      });

      // Aplicar restrições apenas se o username está realmente mudando
      if (currentUser && data.username !== currentUser.username) {
        // Verificar restrição de 30 dias
        if (currentUser.usernameChangedAt) {
          const daysSinceChange = Math.floor(
            (Date.now() - currentUser.usernameChangedAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceChange < 30) {
            const daysRemaining = 30 - daysSinceChange;
            return NextResponse.json(
              { error: `Você só pode alterar o username novamente em ${daysRemaining} dia(s)` },
              { status: 400 }
            );
          }
        }

        // Verificar se o username já está em uso
        const existingUser = await prisma.user.findUnique({
          where: { username: data.username },
          select: { id: true },
        });

        if (existingUser && existingUser.id !== session.user.id) {
          return NextResponse.json(
            { error: "Este username já está em uso" },
            { status: 400 }
          );
        }

        updateData.username = data.username;
        updateData.usernameChangedAt = new Date();
      }
    }

    // Tratar preferências de notificação
    if (data.notifications) {
      if (data.notifications.postLiked !== undefined) {
        updateData.notifyPostLiked = data.notifications.postLiked;
      }
      if (data.notifications.postCommented !== undefined) {
        updateData.notifyPostCommented = data.notifications.postCommented;
      }
      if (data.notifications.connectionRequest !== undefined) {
        updateData.notifyConnectionRequest = data.notifications.connectionRequest;
      }
      if (data.notifications.connectionAccepted !== undefined) {
        updateData.notifyConnectionAccepted = data.notifications.connectionAccepted;
      }
      if (data.notifications.commentReplied !== undefined) {
        updateData.notifyCommentReplied = data.notifications.commentReplied;
      }
      if (data.notifications.messageReceived !== undefined) {
        updateData.notifyMessageReceived = data.notifications.messageReceived;
      }
      if (data.notifications.mention !== undefined) {
        updateData.notifyMention = data.notifications.mention;
      }
    }

    // Tratar configurações de privacidade
    if (data.privacy) {
      if (data.privacy.profileVisibility !== undefined) {
        updateData.profileVisibility = data.privacy.profileVisibility;
      }
      if (data.privacy.showEmail !== undefined) {
        updateData.showEmail = data.privacy.showEmail;
      }
    }

    // Atualizar usuário
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        email: true,
        username: true,
        notifyPostLiked: true,
        notifyPostCommented: true,
        notifyConnectionRequest: true,
        notifyConnectionAccepted: true,
        notifyCommentReplied: true,
        notifyMessageReceived: true,
        notifyMention: true,
        profileVisibility: true,
        showEmail: true,
      },
    });

    return NextResponse.json({
      settings: {
        email: user.email,
        username: user.username,
        notifications: {
          postLiked: user.notifyPostLiked,
          postCommented: user.notifyPostCommented,
          connectionRequest: user.notifyConnectionRequest,
          connectionAccepted: user.notifyConnectionAccepted,
          commentReplied: user.notifyCommentReplied,
          messageReceived: user.notifyMessageReceived,
          mention: user.notifyMention,
        },
        privacy: {
          profileVisibility: user.profileVisibility,
          showEmail: user.showEmail,
        },
      },
    });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao atualizar configurações", error);
  }
}
