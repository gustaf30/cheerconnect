import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { PASSWORD_MIN_LENGTH, PASSWORD_REGEX, PASSWORD_ERROR } from "@/lib/constants";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual é obrigatória"),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, PASSWORD_ERROR)
      .regex(PASSWORD_REGEX, PASSWORD_ERROR),
    confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

// POST /api/settings/password - Alterar senha
export async function POST(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const data = changePasswordSchema.parse(body);

    // Buscar usuário com senha
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se o usuário tem senha (não é apenas OAuth)
    if (!user.password) {
      return NextResponse.json(
        { error: "Você não pode alterar a senha pois entrou com Google. Defina uma senha primeiro." },
        { status: 400 }
      );
    }

    // Verificar senha atual
    const isValidPassword = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Senha atual incorreta" },
        { status: 400 }
      );
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(data.newPassword, 12);

    // Atualizar senha
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword, tokenVersion: { increment: 1 } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao alterar senha", error);
  }
}
