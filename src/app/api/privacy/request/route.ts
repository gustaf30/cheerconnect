import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, internalError, handleZodError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import {
  consumeAccountDeletionChallenge,
  hasValidAccountDeletionChallenge,
} from "@/lib/account-reauth";

const requestSchema = z
  .object({
    type: z.enum(["EXPORT", "DELETE"]),
    username: z.string().min(1).optional(),
    reauthChallengeId: z.string().min(1).optional(),
  })
  .superRefine((data, context) => {
    if (data.type === "DELETE" && (!data.username || !data.reauthChallengeId)) {
      context.addIssue({
        code: "custom",
        message: "Reautenticação é obrigatória para exclusão",
        path: ["reauthChallengeId"],
      });
    }
  });

export async function POST(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const data = requestSchema.parse(await request.json());
    if (data.type === "EXPORT") {
      const privacyRequest = await prisma.privacyRequest.create({
        data: {
          userId: session.user.id,
          type: data.type,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      return NextResponse.json({ request: privacyRequest }, { status: 201 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, username: true, emailVerified: true, tokenVersion: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Verifique seu email antes de solicitar exclusão" },
        { status: 403 }
      );
    }
    if (data.username !== user.username) {
      return NextResponse.json({ error: "Username incorreto" }, { status: 400 });
    }
    if (
      !(await hasValidAccountDeletionChallenge(
        user.id,
        data.reauthChallengeId!,
        user.tokenVersion
      ))
    ) {
      return NextResponse.json(
        { error: "Reautenticação inválida ou expirada" },
        { status: 403 }
      );
    }

    try {
      const privacyRequest = await prisma.$transaction(async (tx) => {
        const consumed = await consumeAccountDeletionChallenge(
          tx,
          user.id,
          data.reauthChallengeId!,
          user.tokenVersion
        );
        if (!consumed) throw new Error("REAUTH_REQUIRED");
        return tx.privacyRequest.create({
          data: {
            userId: user.id,
            type: data.type,
            status: "PENDING",
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            reauthVerifiedAt: new Date(),
          },
        });
      });
      return NextResponse.json({ request: privacyRequest }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === "REAUTH_REQUIRED") {
        return NextResponse.json(
          { error: "Reautenticação inválida ou expirada" },
          { status: 403 }
        );
      }
      throw error;
    }
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao registrar solicitação de privacidade", error);
  }
}
