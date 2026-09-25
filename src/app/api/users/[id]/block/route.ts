import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, internalError } from "@/lib/api-utils";
import { logSecurityEvent } from "@/lib/security-events";

// POST /api/users/[id]/block — Block a user
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: blockedUserId } = await params;
    const userId = session.user.id;

    if (userId === blockedUserId) {
      return NextResponse.json(
        { error: "Você não pode bloquear a si mesmo" },
        { status: 400 }
      );
    }

    // Check if the target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: blockedUserId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    // Check if already blocked
    const existingBlock = await prisma.block.findFirst({
      where: { userId, blockedUserId },
    });

    if (existingBlock) {
      return NextResponse.json(
        { error: "Usuário já está bloqueado" },
        { status: 409 }
      );
    }

    // Create block and remove any existing connection between the users
    await prisma.$transaction([
      prisma.block.create({
        data: { userId, blockedUserId },
      }),
      // Remove connections in both directions
      prisma.connection.deleteMany({
        where: {
          OR: [
            { senderId: userId, receiverId: blockedUserId },
            { senderId: blockedUserId, receiverId: userId },
          ],
        },
      }),
      prisma.teamInvite.deleteMany({
        where: {
          OR: [
            { userId: blockedUserId, invitedById: userId },
            { userId, invitedById: blockedUserId },
            {
              userId: blockedUserId,
              team: { members: { some: { userId, isActive: true } } },
            },
            {
              userId,
              team: { members: { some: { userId: blockedUserId, isActive: true } } },
            },
          ],
        },
      }),
    ]);

    logSecurityEvent("user.blocked", { actorId: userId, blockedUserId });

    return NextResponse.json({ success: true });
  } catch (err) {
    return internalError("block-user", err);
  }
}

// DELETE /api/users/[id]/block — Unblock a user
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: blockedUserId } = await params;
    const userId = session.user.id;

    const block = await prisma.block.findFirst({
      where: { userId, blockedUserId },
    });

    if (!block) {
      return NextResponse.json(
        { error: "Usuário não está bloqueado" },
        { status: 404 }
      );
    }

    await prisma.block.delete({ where: { id: block.id } });

    logSecurityEvent("user.unblocked", { actorId: userId, blockedUserId });

    return NextResponse.json({ success: true });
  } catch (err) {
    return internalError("unblock-user", err);
  }
}
