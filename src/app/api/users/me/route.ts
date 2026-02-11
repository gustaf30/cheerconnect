import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().max(500).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  experience: z.number().min(0).max(50).optional().nullable(),
  skills: z.array(z.string()).max(20).optional(),
  positions: z.array(z.string()).max(10).optional(),
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
export async function DELETE() {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    // Excluir usuário (exclusões em cascata são tratadas pelo schema do Prisma)
    await prisma.user.delete({
      where: { id: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError("Erro ao excluir conta", error);
  }
}
