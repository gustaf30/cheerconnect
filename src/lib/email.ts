import { Message, SMTPClient } from "emailjs";
import { Resend } from "resend";
import logger from "./logger";

export type EmailProvider = "smtp" | "resend" | "log";
type EmailFailureReason = "not_configured" | "delivery_failed";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailSendResult = {
  sent: boolean;
  provider: EmailProvider;
  messageId?: string;
};

export class EmailDeliveryError extends Error {
  readonly provider: EmailProvider;
  readonly reason: EmailFailureReason;

  constructor(provider: EmailProvider, reason: EmailFailureReason) {
    super("Falha ao entregar email");
    this.name = "EmailDeliveryError";
    this.provider = provider;
    this.reason = reason;
  }
}

export function isEmailDeliveryError(error: unknown): error is EmailDeliveryError {
  return error instanceof EmailDeliveryError;
}

function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

function redactEmail(value: string): string {
  const [local, domain] = value.split("@");
  if (!local || !domain) return "[redacted]";
  return `${local.slice(0, 2)}***@${domain}`;
}

function getProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (provider === "resend" || provider === "log") return provider;
  return "smtp";
}

function getFrom(provider: EmailProvider): string {
  const configuredFrom = process.env.EMAIL_FROM?.trim();
  if (configuredFrom) return configuredFrom;

  if (provider === "smtp") {
    const user = process.env.SMTP_USER?.trim();
    return user ? `CheerConnect <${user}>` : "CheerConnect <localhost>";
  }

  return "CheerConnect <onboarding@resend.dev>";
}

function unavailable(
  provider: EmailProvider,
  reason: EmailFailureReason
): EmailSendResult {
  if (isDevelopment()) {
    logger.warn({ provider, reason }, "[email] delivery unavailable; using development fallback");
    return { sent: false, provider: "log" };
  }

  logger.error({ provider, reason }, "[email] delivery unavailable");
  throw new EmailDeliveryError(provider, reason);
}

function getSmtpPort(): number | null {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}

async function sendWithSmtp(message: EmailMessage): Promise<EmailSendResult> {
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const port = getSmtpPort();

  if (!user || !password || !port) {
    return unavailable("smtp", "not_configured");
  }

  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE.trim().toLowerCase() === "true"
    : port === 465;
  const client = new SMTPClient({
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    ssl: secure,
    tls: !secure,
    user,
    password,
    authentication: ["PLAIN", "LOGIN"],
  });

  try {
    await client.sendAsync(
      new Message({
        from: getFrom("smtp"),
        to: message.to,
        subject: message.subject,
        text: message.text,
        attachment: [
          {
            data: message.html,
            alternative: true,
            type: "text/html",
          },
        ],
      })
    );
    return { sent: true, provider: "smtp" };
  } catch {
    return unavailable("smtp", "delivery_failed");
  } finally {
    client.smtp.close();
  }
}

async function sendWithResend(message: EmailMessage): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return unavailable("resend", "not_configured");
  }

  const resend = new Resend(apiKey);
  let result: Awaited<ReturnType<typeof resend.emails.send>>;

  try {
    result = await resend.emails.send({
      from: getFrom("resend"),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  } catch {
    return unavailable("resend", "delivery_failed");
  }

  if (result.error) {
    return unavailable("resend", "delivery_failed");
  }

  return { sent: true, provider: "resend", messageId: result.data?.id };
}

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const provider = getProvider();

  if (provider === "log") {
    if (!isDevelopment()) {
      return unavailable(provider, "not_configured");
    }

    logger.info(
      { to: redactEmail(message.to), subject: message.subject },
      "[email] message logged instead of sent"
    );
    return { sent: false, provider: "log" };
  }

  const result =
    provider === "smtp" ? await sendWithSmtp(message) : await sendWithResend(message);

  if (result.sent) {
    logger.info(
      { provider: result.provider, to: redactEmail(message.to), messageId: result.messageId },
      "[email] message sent"
    );
  }

  return result;
}

export function sanitizeEmailHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export async function sendVerificationEmail(email: string, token: string) {
  const vercelUrl = process.env.VERCEL_URL?.trim().replace(/^https?:\/\//, "");
  const baseUrl =
    process.env.NEXTAUTH_URL?.trim() || (vercelUrl ? `https://${vercelUrl}` : "");

  if (!baseUrl && !isDevelopment()) {
    return unavailable(getProvider(), "not_configured");
  }

  const verificationUrl = `${baseUrl || "http://localhost:3000"}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  return sendEmail({
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
    text: `Verifique seu email e ative sua conta: ${verificationUrl}\n\nEste link expira em 24 horas. Se voce nao criou uma conta, ignore este email.`,
  });
}

export async function sendAccountReauthenticationEmail(email: string, token: string) {
  const vercelUrl = process.env.VERCEL_URL?.trim().replace(/^https?:\/\//, "");
  const baseUrl =
    process.env.NEXTAUTH_URL?.trim() || (vercelUrl ? `https://${vercelUrl}` : "");

  if (!baseUrl && !isDevelopment()) {
    return unavailable(getProvider(), "not_configured");
  }

  const reauthenticationUrl = `${baseUrl || "http://localhost:3000"}/api/users/me/reauthenticate/verify?token=${encodeURIComponent(token)}`;

  return sendEmail({
    to: email,
    subject: "Confirme sua identidade - CheerConnect",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h1 style="color: #e11d48;">CheerConnect</h1>
        <p>Clique no link abaixo para confirmar sua identidade antes de excluir sua conta:</p>
        <a href="${reauthenticationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #e11d48; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Confirmar identidade
        </a>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          Este link expira em 10 minutos e só pode ser usado uma vez. Se voce nao solicitou esta acao, ignore este email.
        </p>
      </div>
    `,
    text: `Confirme sua identidade antes de excluir sua conta: ${reauthenticationUrl}\n\nEste link expira em 10 minutos e só pode ser usado uma vez.`,
  });
}
