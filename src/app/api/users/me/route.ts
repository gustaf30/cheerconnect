import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { deleteUserMediaAssets } from "@/lib/media-assets";
import {
  consumeAccountDeletionChallenge,
  hasValidAccountDeletionChallenge,
} from "@/lib/account-reauth";

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().max(500).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  experience: z.number().min(0).max(50).optional().nullable(),
  skills: z.array(z.string()).max(20).optional(),
  positions: z.array(z.string()).max(10).optional(),
});

const deleteAccountSchema = z.object({
  username: z.string().min(1, "Username é obrigatório"),
  reauthChallengeId: z.string().min(1, "Reautenticação é obrigatória"),
});

// GET /api/users/me - Buscar perfil do usuário atual
export async function GET() {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        avatar: true,
        banner: true,
        bio: true,
        location: true,
        birthDate: true,
        positions: true,
        experience: true,
        skills: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    return internalError("Erro ao buscar perfil", error);
  }
}

// PATCH /api/users/me - Atualizar perfil do usuário atual
export async function PATCH(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const data = updateProfileSchema.parse(body);

    // Converter strings de posições para valores enum se fornecidas
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.bio !== undefined) updateData.bio = data.bio || null;
    if (data.location !== undefined) updateData.location = data.location || null;
    if (data.experience !== undefined) updateData.experience = data.experience;
    if (data.skills !== undefined) updateData.skills = data.skills;
    if (data.positions !== undefined) updateData.positions = data.positions;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        bio: true,
        location: true,
        positions: true,
        experience: true,
        skills: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao atualizar perfil", error);
  }
}

// DELETE /api/users/me - Excluir conta do usuário atual
export async function DELETE(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const data = deleteAccountSchema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, username: true, emailVerified: true, tokenVersion: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Verifique seu email antes de excluir sua conta" },
        { status: 403 }
      );
    }
    if (data.username !== user.username) {
      return NextResponse.json({ error: "Username incorreto" }, { status: 400 });
    }
    if (
      !(await hasValidAccountDeletionChallenge(
        user.id,
        data.reauthChallengeId,
        user.tokenVersion
      ))
    ) {
      return NextResponse.json(
        { error: "Reautenticação inválida ou expirada" },
        { status: 403 }
      );
    }

    const adminMemberships = await prisma.teamMember.findMany({
      where: { userId: user.id, isActive: true, isAdmin: true },
      select: {
        team: {
          select: {
            id: true,
            name: true,
            members: {
              where: { isActive: true, isAdmin: true },
              select: { id: true },
            },
          },
        },
      },
    });
    const soleAdminTeams = adminMemberships.filter(
      ({ team }) => team.members.length <= 1
    );
    if (soleAdminTeams.length > 0) {
      return NextResponse.json(
        {
          error: "Promova outro administrador antes de excluir sua conta",
          teams: soleAdminTeams.map(({ team }) => ({
            id: team.id,
            name: team.name,
          })),
        },
        { status: 409 }
      );
    }

    const consumed = await prisma.$transaction((tx) =>
      consumeAccountDeletionChallenge(tx, user.id, data.reauthChallengeId, user.tokenVersion)
    );
    if (!consumed) {
      return NextResponse.json(
        { error: "Reautenticação inválida ou expirada" },
        { status: 403 }
      );
    }

    await deleteUserMediaAssets(user.id);

    await prisma.$transaction(async (tx) => {
      const currentAdminMemberships = await tx.teamMember.findMany({
        where: { userId: user.id, isActive: true, isAdmin: true },
        select: {
          team: {
            select: {
              id: true,
              name: true,
              members: {
                where: { isActive: true, isAdmin: true },
                select: { id: true },
              },
            },
          },
        },
      });
      if (currentAdminMemberships.some(({ team }) => team.members.length <= 1)) {
        throw new Error("SOLE_ADMIN");
      }
      await tx.activityLog.updateMany({
        where: { actorId: user.id },
        data: {
          actorId: null,
          metadata: Prisma.JsonNull,
          anonymizedAt: new Date(),
        },
      });
      await tx.user.delete({ where: { id: user.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "SOLE_ADMIN") {
      return NextResponse.json(
        { error: "Promova outro administrador antes de excluir sua conta" },
        { status: 409 }
      );
    }
    return handleZodError(error) ?? internalError("Erro ao excluir conta", error);
  }
}
