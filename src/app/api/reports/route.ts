import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createReportSchema = z.object({
  reason: z.string().min(1, "Motivo é obrigatório").max(200),
  description: z.string().max(1000).optional(),
  contentType: z.enum(["post", "comment", "user"]),
  contentId: z.string().min(1),
});

// POST /api/reports - Criar uma denúncia
export async function POST(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const data = createReportSchema.parse(body);

    // Verificar se o conteúdo existe
    if (data.contentType === "post") {
      const post = await prisma.post.findUnique({ where: { id: data.contentId } });
      if (!post) {
        return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
      }
    } else if (data.contentType === "comment") {
      const comment = await prisma.comment.findUnique({ where: { id: data.contentId } });
      if (!comment) {
        return NextResponse.json({ error: "Comentário não encontrado" }, { status: 404 });
      }
    } else if (data.contentType === "user") {
      const user = await prisma.user.findUnique({ where: { id: data.contentId } });
      if (!user) {
        return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
      }
    }

    // Impedir denúncia duplicada do mesmo usuário para o mesmo conteúdo
    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId: session.user.id,
        contentType: data.contentType,
        contentId: data.contentId,
      },
    });

    if (existingReport) {
      return NextResponse.json(
        { error: "Você já denunciou este conteúdo" },
        { status: 400 }
      );
    }

    const report = await prisma.report.create({
      data: {
        reason: data.reason,
        description: data.description,
        contentType: data.contentType,
        contentId: data.contentId,
        reporterId: session.user.id,
      },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao criar denúncia", error);
  }
}
