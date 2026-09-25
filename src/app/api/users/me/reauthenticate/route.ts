import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { createAccountDeletionChallenge } from "@/lib/account-reauth";
import { isEmailDeliveryError, sendAccountReauthenticationEmail } from "@/lib/email";

export async function POST() {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, emailVerified: true, tokenVersion: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Verifique seu email antes de continuar" },
        { status: 403 }
      );
    }

    const challenge = await createAccountDeletionChallenge(user.id, user.tokenVersion);
    const delivery = await sendAccountReauthenticationEmail(user.email, challenge.token);

    if (!delivery.sent && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Não foi possível enviar o e-mail de confirmação" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
    });
  } catch (error) {
    if (isEmailDeliveryError(error)) {
      return NextResponse.json(
        { error: "Não foi possível enviar o e-mail de confirmação" },
        { status: 503 }
      );
    }
    return internalError("Erro ao solicitar reautenticação", error);
  }
}
