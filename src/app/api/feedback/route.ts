import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleZodError, internalError } from "@/lib/api-utils";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FEEDBACK_LIMIT = 3;
const FEEDBACK_WINDOW = 60_000 * 10; // 3 per 10 minutes

const feedbackSchema = z.object({
  message: z.string().min(1, "Mensagem é obrigatória").max(2000),
});

const FEEDBACK_EMAIL = "gustavoferraz405@gmail.com";

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

    if (!resend) {
      console.log("[feedback] RESEND_API_KEY not set — dev fallback");
      console.log(`[feedback] From: ${userName} (${userEmail})`);
      console.log(`[feedback] Message: ${message}`);
      return NextResponse.json({ success: true });
    }

    const { error: sendError } = await resend.emails.send({
      from: "CheerConnect <onboarding@resend.dev>",
      to: FEEDBACK_EMAIL,
      subject: `[Feedback] CheerConnect - ${userName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
          <h2 style="color: #e11d48;">Novo Feedback - CheerConnect</h2>
          <p><strong>De:</strong> ${userName} (${userEmail})</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
          <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
        </div>
      `,
    });

    if (sendError) {
      console.error("[feedback] Resend error:", sendError);
      return NextResponse.json(
        { error: "Falha ao enviar feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return internalError("POST /api/feedback", err);
  }
}
