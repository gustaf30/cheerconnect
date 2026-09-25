import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth, internalError, areUsersBlocked } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { publishRealtimeEvent } from "@/lib/realtime-bus";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;
    const { id: commentId } = await params;
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, author: { select: { id: true } } },
    });
    if (!comment) {
      return NextResponse.json({ error: "Comentário não encontrado" }, { status: 404 });
    }
    if (await areUsersBlocked(session.user.id, comment.author.id)) {
      return NextResponse.json({ error: "Não é possível interagir com este comentário" }, { status: 403 });
    }
    try {
      await prisma.commentLike.create({ data: { userId: session.user.id, commentId } });
      if (comment.author.id !== session.user.id) {
        publishRealtimeEvent({ userId: comment.author.id, type: "notification" });
      }
      return NextResponse.json({ liked: true });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json({ liked: true });
      }
      throw error;
    }
  } catch (error) {
    return internalError("Erro ao curtir comentário", error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;
    const { id: commentId } = await params;
    const result = await prisma.commentLike.deleteMany({
      where: { userId: session.user.id, commentId },
    });
    return NextResponse.json({ liked: false, removed: result.count });
  } catch (error) {
    return internalError("Erro ao remover curtida do comentário", error);
  }
}
