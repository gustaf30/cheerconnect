import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { parsePaginationLimit } from "@/lib/api-utils";
import { ReportStatus } from "@prisma/client";
import { logActivity } from "@/lib/audit";

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

export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const moderator = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });
    if (!moderator?.isAdmin) {
      return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    if (statusParam && !Object.values(ReportStatus).includes(statusParam as ReportStatus)) {
      return NextResponse.json({ error: "Status de denúncia inválido" }, { status: 400 });
    }
    const status = statusParam as ReportStatus | null;
    const cursor = searchParams.get("cursor");
    const limit = parsePaginationLimit(searchParams, 25, 100);
    const reports = await prisma.report.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      include: {
        reporter: { select: { id: true, name: true, username: true } },
        moderator: { select: { id: true, name: true, username: true } },
      },
    });
    const hasMore = reports.length > limit;
    const data = hasMore ? reports.slice(0, limit) : reports;
    const reportsWithContent = await Promise.all(
      data.map(async (report) => {
        if (report.contentType === "post") {
          const content = await prisma.post.findUnique({
            where: { id: report.contentId },
            select: {
              id: true,
              content: true,
              author: { select: { id: true, username: true } },
              createdAt: true,
            },
          });
          return { ...report, content };
        }
        if (report.contentType === "comment") {
          const content = await prisma.comment.findUnique({
            where: { id: report.contentId },
            select: {
              id: true,
              content: true,
              author: { select: { id: true, username: true } },
              postId: true,
              createdAt: true,
            },
          });
          return { ...report, content };
        }
        const content = await prisma.user.findUnique({
          where: { id: report.contentId },
          select: { id: true, name: true, username: true, bio: true },
        });
        return { ...report, content };
      })
    );
    return NextResponse.json({
      reports: reportsWithContent,
      nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return internalError("Erro ao listar denúncias", error);
  }
}

const resolveReportSchema = z.object({
  status: z.enum(["REVIEWED", "RESOLVED", "DISMISSED"]),
  resolutionNote: z.string().trim().max(1000).optional().nullable(),
});

export async function PATCH(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const moderator = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });
    if (!moderator?.isAdmin) {
      return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
    }

    const body = await request.json();
    const data = resolveReportSchema.parse(body);
    const reportId = z.string().min(1).parse(body.id);
    const report = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: data.status,
        resolutionNote: data.resolutionNote || null,
        moderatorId: session.user.id,
        resolvedAt: data.status === "REVIEWED" ? null : new Date(),
      },
    });

    logActivity({
      action: "REPORT_REVIEWED",
      entityType: "report",
      entityId: report.id,
      actorId: session.user.id,
      metadata: { status: data.status },
    });

    return NextResponse.json({ report });
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao resolver denúncia", error);
  }
}
