// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockClose,
  mockMessage,
  mockResend,
  mockResendSend,
  mockSendAsync,
  mockSMTPClient,
} = vi.hoisted(() => {
  const close = vi.fn();
  const sendAsync = vi.fn();
  const message = vi.fn(function Message(headers: unknown) {
    return { headers };
  });
  const resendSend = vi.fn();
  const smtpClient = vi.fn(function SMTPClient() {
    return {
      sendAsync,
      smtp: { close },
    };
  });
  const resend = vi.fn(function Resend() {
    return { emails: { send: resendSend } };
  });
  return {
    mockClose: close,
    mockMessage: message,
    mockResend: resend,
    mockResendSend: resendSend,
    mockSendAsync: sendAsync,
    mockSMTPClient: smtpClient,
  };
});

vi.mock("emailjs", () => ({
  Message: mockMessage,
  SMTPClient: mockSMTPClient,
}));

vi.mock("resend", () => ({
  Resend: mockResend,
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import {
  EmailDeliveryError,
  isEmailDeliveryError,
  sanitizeEmailHeader,
  sendAccountReauthenticationEmail,
  sendEmail,
  sendVerificationEmail,
} from "../email";

const message = {
  to: "recipient@example.com",
  subject: "Test subject",
  html: "<p>HTML</p>",
  text: "Text",
};

describe("email provider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      EMAIL_PROVIDER: "smtp",
      SMTP_USER: "sender@gmail.com",
      SMTP_PASSWORD: "app-password",
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      EMAIL_FROM: "CheerConnect <sender@gmail.com>",
    };
    vi.stubEnv("NODE_ENV", "test");
    mockSendAsync.mockResolvedValue({});
    mockResendSend.mockResolvedValue({ data: { id: "resend-id" }, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = originalEnv;
  });

  it("sends through Gmail SMTP with text and HTML alternatives", async () => {
    const result = await sendEmail(message);

    expect(result).toEqual({ sent: true, provider: "smtp" });
    expect(mockSMTPClient).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 587,
      ssl: false,
      tls: true,
      user: "sender@gmail.com",
      password: "app-password",
      authentication: ["PLAIN", "LOGIN"],
    });
    expect(mockMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "CheerConnect <sender@gmail.com>",
        to: message.to,
        subject: message.subject,
        text: message.text,
      })
    );
    expect(mockMessage.mock.calls[0][0]).toMatchObject({
      attachment: [{ data: message.html, alternative: true, type: "text/html" }],
    });
    expect(mockSendAsync).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("supports direct TLS when SMTP_SECURE is true", async () => {
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";

    await sendEmail(message);

    expect(mockSMTPClient).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, ssl: true, tls: false })
    );
  });

  it("uses Resend only when explicitly selected", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "resend-key";

    const result = await sendEmail(message);

    expect(result).toEqual({ sent: true, provider: "resend", messageId: "resend-id" });
    expect(mockResend).toHaveBeenCalledWith("resend-key");
    expect(mockResendSend).toHaveBeenCalledWith({
      from: "CheerConnect <sender@gmail.com>",
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    expect(mockSMTPClient).not.toHaveBeenCalled();
  });

  it("does not use the restricted Resend test sender without EMAIL_FROM", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "resend-key";
    delete process.env.EMAIL_FROM;
    vi.stubEnv("NODE_ENV", "development");

    const result = await sendEmail(message);

    expect(result).toEqual({ sent: false, provider: "log" });
    expect(mockResend).not.toHaveBeenCalled();
  });

  it("uses a development log fallback when SMTP is not configured", async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    vi.stubEnv("NODE_ENV", "development");

    const result = await sendEmail(message);

    expect(result).toEqual({ sent: false, provider: "log" });
    expect(mockSMTPClient).not.toHaveBeenCalled();
  });

  it("throws a safe delivery error when production SMTP is not configured", async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    vi.stubEnv("NODE_ENV", "production");

    await expect(sendEmail(message)).rejects.toBeInstanceOf(EmailDeliveryError);
    expect(mockSMTPClient).not.toHaveBeenCalled();
  });

  it("does not allow the log provider in production", async () => {
    process.env.EMAIL_PROVIDER = "log";
    vi.stubEnv("NODE_ENV", "production");

    await expect(sendEmail(message)).rejects.toBeInstanceOf(EmailDeliveryError);
    expect(mockSMTPClient).not.toHaveBeenCalled();
  });

  it("does not expose SMTP errors or credentials in the thrown error", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockSendAsync.mockRejectedValueOnce(new Error("app-password leaked"));

    const error = await sendEmail(message).catch((value: unknown) => value);

    expect(isEmailDeliveryError(error)).toBe(true);
    expect(String(error)).not.toContain("app-password");
  });

  it("encodes the verification token in both message bodies", async () => {
    process.env.NEXTAUTH_URL = "https://example.com/";

    await sendVerificationEmail("recipient@example.com", "token/with+characters");

    const payload = mockMessage.mock.calls[0][0] as {
      text: string;
      attachment: Array<{ data: string }>;
    };
    expect(payload.text).toContain("token%2Fwith%2Bcharacters");
    expect(payload.attachment[0].data).toContain("token%2Fwith%2Bcharacters");
  });

  it("builds an encoded account deletion reauthentication link", async () => {
    process.env.NEXTAUTH_URL = "https://example.com/";

    await sendAccountReauthenticationEmail("recipient@example.com", "token/with+characters");

    const payload = mockMessage.mock.calls[0][0] as {
      text: string;
      attachment: Array<{ data: string }>;
    };
    expect(payload.text).toContain("/api/users/me/reauthenticate/verify?token=token%2Fwith%2Bcharacters");
    expect(payload.attachment[0].data).toContain("10 minutos");
  });

  it("removes line breaks from email subjects", () => {
    expect(sanitizeEmailHeader("Hello\r\nBcc: attacker@example.com")).toBe(
      "Hello Bcc: attacker@example.com"
    );
  });
});
