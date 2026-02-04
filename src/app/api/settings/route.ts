import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
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

// GET /api/settings - Get current user's settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        username: true,
        password: true,
        notifyPostLiked: true,
        notifyPostCommented: true,
        notifyConnectionRequest: true,
        notifyConnectionAccepted: true,
        notifyCommentReplied: true,
        notifyMessageReceived: true,
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

    // Calculate username change availability
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const canChangeUsername = !user.usernameChangedAt ||
      (Date.now() - user.usernameChangedAt.getTime()) >= THIRTY_DAYS_MS;
    const nextUsernameChangeDate = user.usernameChangedAt
      ? new Date(user.usernameChangedAt.getTime() + THIRTY_DAYS_MS)
      : null;

    // Calculate days until username can be changed
    const daysUntilUsernameChange = !canChangeUsername && nextUsernameChangeDate
      ? Math.ceil((nextUsernameChangeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    return NextResponse.json({
      settings: {
        email: user.email,
        username: user.username,
        hasPassword: !!user.password,
        notifications: {
          postLiked: user.notifyPostLiked,
          postCommented: user.notifyPostCommented,
          connectionRequest: user.notifyConnectionRequest,
          connectionAccepted: user.notifyConnectionAccepted,
          commentReplied: user.notifyCommentReplied,
          messageReceived: user.notifyMessageReceived,
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
    console.error("Get settings error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// PATCH /api/settings - Update current user's settings
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const data = updateSettingsSchema.parse(body);

    // Build update data
    const updateData: Record<string, unknown> = {};

    // Handle username change
    if (data.username !== undefined) {
      // Get current user data including usernameChangedAt
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { username: true, usernameChangedAt: true },
      });

      // Only apply restrictions if username is actually changing
      if (currentUser && data.username !== currentUser.username) {
        // Check 30-day restriction
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

        // Check if username is already taken
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

    // Handle notification preferences
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
    }

    // Handle privacy settings
    if (data.privacy) {
      if (data.privacy.profileVisibility !== undefined) {
        updateData.profileVisibility = data.privacy.profileVisibility;
      }
      if (data.privacy.showEmail !== undefined) {
        updateData.showEmail = data.privacy.showEmail;
      }
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        email: true,
        username: true,
        password: true,
        notifyPostLiked: true,
        notifyPostCommented: true,
        notifyConnectionRequest: true,
        notifyConnectionAccepted: true,
        notifyCommentReplied: true,
        notifyMessageReceived: true,
        profileVisibility: true,
        showEmail: true,
      },
    });

    return NextResponse.json({
      settings: {
        email: user.email,
        username: user.username,
        hasPassword: !!user.password,
        notifications: {
          postLiked: user.notifyPostLiked,
          postCommented: user.notifyPostCommented,
          connectionRequest: user.notifyConnectionRequest,
          connectionAccepted: user.notifyConnectionAccepted,
          commentReplied: user.notifyCommentReplied,
          messageReceived: user.notifyMessageReceived,
        },
        privacy: {
          profileVisibility: user.profileVisibility,
          showEmail: user.showEmail,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
