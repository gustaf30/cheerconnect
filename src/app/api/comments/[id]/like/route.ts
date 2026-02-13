import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

    // Try to create; if P2002 (already liked), delete instead
    try {
      await prisma.commentLike.create({
        data: {
          userId: session.user.id,
          commentId,
        },
      });
      return NextResponse.json({ liked: true });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        await prisma.commentLike.deleteMany({
          where: {
            userId: session.user.id,
            commentId,
          },
        });
        return NextResponse.json({ liked: false });
      }
      throw err;
    }
  } catch (error) {
    return internalError("Erro ao alternar curtida do comentário", error);
  }
}
