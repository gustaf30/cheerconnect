import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET /api/posts/[id]/edits - Get edit history for a post
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const edits = await prisma.postEdit.findMany({
      where: { postId: id },
      orderBy: { editedAt: "desc" },
    });

    return NextResponse.json({ edits });
  } catch (error) {
    return internalError("Erro ao buscar histórico de edições", error);
  }
}
