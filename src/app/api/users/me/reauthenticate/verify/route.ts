import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { verifyAccountDeletionChallenge } from "@/lib/account-reauth";

function redirectToSettings(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/settings", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const token = request.nextUrl.searchParams.get("token");
  if (!token) return redirectToSettings(request, { reauthError: "invalid-token" });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true, tokenVersion: true },
  });
  if (!user?.emailVerified) {
    return redirectToSettings(request, { reauthError: "email-unverified" });
  }

  const result = await verifyAccountDeletionChallenge(
    session.user.id,
    token,
    user.tokenVersion
  );
  if (!result.ok) {
    return redirectToSettings(request, { reauthError: result.reason });
  }

  return redirectToSettings(request, {
    reauthVerified: "true",
    reauthChallengeId: result.challengeId,
  });
}
