import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Mark expired PENDING invites
  const expired = await prisma.teamInvite.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  // Delete old non-pending invites (EXPIRED/REJECTED older than 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const deleted = await prisma.teamInvite.deleteMany({
    where: {
      status: { in: ["EXPIRED", "REJECTED"] },
      createdAt: { lt: thirtyDaysAgo },
    },
  });

  return NextResponse.json({
    expired: expired.count,
    deleted: deleted.count,
    timestamp: now.toISOString(),
  });
}
