// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockInternalError, mockRateLimit, mockSendEmail, mockRequireAuth } = vi.hoisted(() => ({
  mockInternalError: vi.fn(),
  mockRateLimit: vi.fn(),
  mockSendEmail: vi.fn(),
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/api-utils", () => ({
  requireAuth: mockRequireAuth,
  handleZodError: vi.fn(() => null),
  internalError: mockInternalError,
}));

vi.mock("@/lib/email", () => ({
  isEmailDeliveryError: (error: unknown) =>
    Boolean(error && typeof error === "object" && "name" in error && error.name === "EmailDeliveryError"),
  sanitizeEmailHeader: (value: string) => value.replace(/[\r\n]+/g, " ").trim(),
  sendEmail: mockSendEmail,
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  rateLimitHeaders: vi.fn(() => ({})),
}));

import { POST } from "@/app/api/feedback/route";

function request(message: string) {
  return new NextRequest("http://localhost:3000/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
}

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1", name: "Alice", email: "alice@example.com" } },
    });
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 2, resetMs: 60_000 });
    mockSendEmail.mockResolvedValue({ sent: true, provider: "smtp" });
  });

  it("sends escaped feedback through the shared email service", async () => {
    const response = await POST(request("<script>alert(1)</script>\nhello"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "gustavoferraz405@gmail.com",
        subject: "[Feedback] CheerConnect - Alice",
        text: "De: Alice (alice@example.com)\n\n<script>alert(1)</script>\nhello",
        html: expect.stringContaining("&lt;script&gt;alert(1)&lt;/script&gt;"),
      })
    );
  });

  it("returns 503 when delivery fails in production", async () => {
    mockSendEmail.mockRejectedValueOnce({
      name: "EmailDeliveryError",
      provider: "smtp",
      reason: "not_configured",
    });

    const response = await POST(request("hello"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Serviço de email indisponível");
    expect(mockInternalError).not.toHaveBeenCalled();
  });
});
