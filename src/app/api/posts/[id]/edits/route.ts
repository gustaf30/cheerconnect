import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET /api/posts/[id]/edits - Get edit history for a post
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await params;

    // Verify the requesting user is the post author
    const post = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!post) {
      return NextResponse.json(
        { error: "Post não encontrado" },
        { status: 404 }
      );
    }

    if (post.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "Apenas o autor pode ver o histórico de edições" },
        { status: 403 }
      );
    }

    const edits = await prisma.postEdit.findMany({
      where: { postId: id },
      orderBy: { editedAt: "desc" },
    });

    return NextResponse.json({ edits });
  } catch (error) {
    return internalError("Erro ao buscar histórico de edições", error);
  }
}
