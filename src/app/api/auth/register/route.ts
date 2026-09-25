import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { handleZodError, internalError } from "@/lib/api-utils";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { PASSWORD_MIN_LENGTH, PASSWORD_REGEX, PASSWORD_ERROR } from "@/lib/constants";
import { isEmailDeliveryError, sendVerificationEmail } from "@/lib/email";

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  username: z
    .string()
    .trim()
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

    const token = crypto.randomUUID();
    try {
      await prisma.verificationToken.create({
        data: {
          identifier: email,
          token,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    } catch (tokenError) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
      throw tokenError;
    }

    // Em produção, a indisponibilidade de email retorna 503; em dev, não bloqueia o registro
    try {
      await sendVerificationEmail(email, token);
    } catch (emailError) {
      if (isEmailDeliveryError(emailError)) {
        logger.error(
          { provider: emailError.provider, reason: emailError.reason },
          "[register] email delivery failed"
        );

        try {
          await prisma.verificationToken.deleteMany({ where: { identifier: email } });
          await prisma.user.delete({ where: { id: user.id } });
        } catch {
          logger.error("[register] failed to roll back user after email error");
        }

        return NextResponse.json(
          { error: "Serviço de email indisponível" },
          { status: 503 }
        );
      }

      logger.error("[register] unexpected email delivery error");
    }

    return NextResponse.json(
      { success: true, userId: user.id, requiresEmailVerification: true },
      { status: 201 }
    );
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao registrar usuário", error);
  }
}
