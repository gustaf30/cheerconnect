import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET /api/tags/trending — Top 8 hashtags by post count in last 7 days
export async function GET() {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const grouped = await prisma.postTag.groupBy({
      by: ["tagId"],
      _count: { postId: true },
      where: {
        post: { createdAt: { gte: sevenDaysAgo } },
      },
      orderBy: { _count: { postId: "desc" } },
      take: 8,
    });

    if (grouped.length === 0) {
      return NextResponse.json(
        { tags: [] },
        {
          headers: {
            "Cache-Control":
              "public, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    }

    const tagIds = grouped.map((g) => g.tagId);
    const tags = await prisma.tag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true, name: true },
    });

    const tagMap = new Map(tags.map((t) => [t.id, t.name]));

    const result = grouped.map((g) => ({
      name: tagMap.get(g.tagId) || "",
      postCount: g._count.postId,
    }));

    return NextResponse.json(
      { tags: result },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    return internalError("Erro ao buscar tags em alta", err);
  }
}
