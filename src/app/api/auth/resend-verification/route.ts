import { NextResponse } from "next/server";
import { z } from "zod";
import { handleZodError, internalError } from "@/lib/api-utils";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { isEmailDeliveryError, sendVerificationEmail } from "@/lib/email";

const resendSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = resendSchema.parse(body);

    // Mensagem genérica para não revelar se o email existe
    const genericResponse = NextResponse.json(
      { success: true },
      { status: 200 }
    );

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    });

    // Não revelar se o email existe ou se já foi verificado
    if (!user || user.emailVerified) {
      return genericResponse;
    }

    // Deletar tokens antigos para esse email
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });

    // Criar novo token
    const token = crypto.randomUUID();
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      },
    });

    try {
      await sendVerificationEmail(email, token);
    } catch (emailError) {
      if (isEmailDeliveryError(emailError)) {
        logger.error(
          { provider: emailError.provider, reason: emailError.reason },
          "[resend-verification] email delivery failed"
        );
        return genericResponse;
      }

      logger.error("[resend-verification] unexpected email delivery error");
    }

    return genericResponse;
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao reenviar verificação", error);
  }
}
