import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().max(500).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  experience: z.number().min(0).max(50).optional().nullable(),
  skills: z.array(z.string()).optional(),
  positions: z.array(z.string()).optional(),
});

// GET /api/users/me - Get current user's profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

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
    console.error("Get profile error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// PATCH /api/users/me - Update current user's profile
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const data = updateProfileSchema.parse(body);

    // Convert positions strings to enum values if provided
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
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
