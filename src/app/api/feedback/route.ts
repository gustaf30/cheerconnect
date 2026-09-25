import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import logger from "@/lib/logger";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import {
  isEmailDeliveryError,
  sanitizeEmailHeader,
  sendEmail,
} from "@/lib/email";

const FEEDBACK_LIMIT = 3;
const FEEDBACK_WINDOW = 60_000 * 10; // 3 per 10 minutes

const feedbackSchema = z.object({
  message: z.string().min(1, "Mensagem é obrigatória").max(2000),
});

const FEEDBACK_EMAIL = "gustavoferraz405@gmail.com";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const rl = rateLimit(
      `feedback:${session.user.id}`,
      FEEDBACK_LIMIT,
      FEEDBACK_WINDOW
    );
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Muitos feedbacks enviados. Tente novamente mais tarde." },
        {
          status: 429,
          headers: rateLimitHeaders(FEEDBACK_LIMIT, rl.remaining, rl.resetMs),
        }
      );
    }

    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return (
        handleZodError(parsed.error) ??
        NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
      );
    }

    const { message } = parsed.data;
    const userName = session.user.name || "Usuário";
    const userEmail = session.user.email || "sem email";

    await sendEmail({
      to: FEEDBACK_EMAIL,
      subject: sanitizeEmailHeader(`[Feedback] CheerConnect - ${userName}`),
      text: `De: ${userName} (${userEmail})\n\n${message}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
          <h2 style="color: #e11d48;">Novo Feedback - CheerConnect</h2>
          <p><strong>De:</strong> ${escapeHtml(userName)} (${escapeHtml(userEmail)})</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
          <p style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(message)}</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (isEmailDeliveryError(err)) {
      logger.error(
        { provider: err.provider, reason: err.reason },
        "[feedback] email delivery failed"
      );
      return NextResponse.json(
        { error: "Serviço de email indisponível" },
        { status: 503 }
      );
    }

    return internalError("POST /api/feedback", err);
  }
}
