import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// POST /api/comments/[id]/like - Alternar curtida em um comentário
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: commentId } = await params;

    // Verificar se o comentário existe
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true },
    });

    if (!comment) {
      return NextResponse.json(
        { error: "Comentário não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se já curtiu
    const existingLike = await prisma.commentLike.findUnique({
      where: {
        userId_commentId: {
          userId: session.user.id,
          commentId,
        },
      },
    });

    if (existingLike) {
      // Descurtir
      await prisma.commentLike.delete({
        where: { id: existingLike.id },
      });

      return NextResponse.json({ liked: false });
    } else {
      // Curtir
      await prisma.commentLike.create({
        data: {
          userId: session.user.id,
          commentId,
        },
      });

      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    return internalError("Erro ao alternar curtida do comentário", error);
  }
}
