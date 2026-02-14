import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { PASSWORD_MIN_LENGTH, PASSWORD_REGEX, PASSWORD_ERROR } from "@/lib/constants";
import { sendVerificationEmail } from "@/lib/email";

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  username: z
    .string()
    .min(3, "Username deve ter pelo menos 3 caracteres")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username pode conter apenas letras, números e underline"
    ),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, PASSWORD_ERROR)
    .regex(PASSWORD_REGEX, PASSWORD_ERROR),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, username, password } = registerSchema.parse(body);

    // Verificar se o email ou username já existem (single query)
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Uma conta com este email ou username já existe" },
        { status: 409 }
      );
    }

    // Criptografar senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        name,
        email,
        username,
        password: hashedPassword,
      },
    });

    // Gerar token de verificação de email
    const token = crypto.randomUUID();
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Enviar email de verificação (não falhar o registro se o email falhar)
    try {
      await sendVerificationEmail(email, token);
    } catch (emailError) {
      console.error("[register] Falha ao enviar email de verificação:", emailError);
    }

    return NextResponse.json(
      { message: "Verifique seu email para ativar sua conta", userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao registrar usuário", error);
  }
}
