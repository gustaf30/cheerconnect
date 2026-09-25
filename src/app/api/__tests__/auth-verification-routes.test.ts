// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockPrisma, mockSendVerificationEmail } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    verificationToken: { findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
  mockSendVerificationEmail: vi.fn(),
}));

vi.mock("@/lib/api-utils", () => ({
  handleZodError: () => null,
  internalError: () => NextResponse.json({ error: "internal" }, { status: 500 }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn() } }));
vi.mock("@/lib/email", () => ({
  isEmailDeliveryError: () => false,
  sendVerificationEmail: mockSendVerificationEmail,
}));

import { POST as resend } from "@/app/api/auth/resend-verification/route";
import { GET as verify } from "@/app/api/auth/verify-email/route";

describe("email verification routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockResolvedValue([]);
  });

  it("normalizes the email before resending", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", emailVerified: null });
    mockPrisma.verificationToken.create.mockResolvedValue({});
    mockSendVerificationEmail.mockResolvedValue({ sent: true, provider: "smtp" });

    const response = await resend(
      new Request("http://localhost:3000/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: " User@Example.com " }),
      })
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "user@example.com" } })
    );
    expect(mockSendVerificationEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.any(String)
    );
  });

  it("redirects invalid verification links to the resend screen", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue(null);

    const response = await verify(
      new NextRequest("http://localhost:3000/api/auth/verify-email?token=invalid")
    );

    expect(response.headers.get("location")).toContain("/verify-email?error=invalid-token");
  });

  it("marks a valid token as verified", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue({
      identifier: "user@example.com",
      expires: new Date(Date.now() + 60_000),
    });

    const response = await verify(
      new NextRequest("http://localhost:3000/api/auth/verify-email?token=valid")
    );

    expect(response.headers.get("location")).toContain("/verify-email?verified=true");
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});
