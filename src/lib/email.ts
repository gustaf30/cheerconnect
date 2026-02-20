import { Resend } from "resend";
import logger from "./logger";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendVerificationEmail(email: string, token: string) {
  const baseUrl = process.env.NEXTAUTH_URL ?? `https://${process.env.VERCEL_URL}`;
  const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

  if (!resend) {
    logger.info("[email] RESEND_API_KEY não configurada — fallback dev");
    logger.info(`[email] URL de verificação para ${email}: ${verificationUrl}`);
    return;
  }

  const { data, error } = await resend.emails.send({
    from: "CheerConnect <onboarding@resend.dev>",
    to: email,
    subject: "Verifique seu email - CheerConnect",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h1 style="color: #e11d48;">CheerConnect</h1>
        <p>Clique no link abaixo para verificar seu email e ativar sua conta:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #e11d48; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Verificar Email
        </a>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          Este link expira em 24 horas. Se voce nao criou uma conta, ignore este email.
        </p>
      </div>
    `,
  });

  if (error) {
    logger.error({ err: error }, "[email] erro Resend");
    throw new Error(`Falha ao enviar email: ${error.message}`);
  }

  logger.info(`[email] email de verificação enviado para ${email} (id: ${data?.id})`);
}
