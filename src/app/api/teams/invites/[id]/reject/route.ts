import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// POST /api/teams/invites/[id]/reject - Rejeitar convite
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;

    // Encontrar o convite
    const invite = await prisma.teamInvite.findUnique({
      where: { id },
    });

    if (!invite) {
      return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
    }

    // Verificar se o convite é para o usuário atual
    if (invite.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Este convite não é para você" },
        { status: 403 }
      );
    }

    // Verificar se o convite ainda está pendente
    if (invite.status !== "PENDING") {
      return NextResponse.json(
        { error: "Este convite não está mais pendente" },
        { status: 400 }
      );
    }

    // Atualizar status do convite
    await prisma.teamInvite.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError("Erro ao rejeitar convite", error);
  }
}
