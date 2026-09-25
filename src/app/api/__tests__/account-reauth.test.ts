// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma, mockRequireAuth, mockCreateChallenge, mockVerifyChallenge, mockSendEmail } = vi.hoisted(() => ({
  mockPrisma: { user: { findUnique: vi.fn() } },
  mockRequireAuth: vi.fn(),
  mockCreateChallenge: vi.fn(),
  mockVerifyChallenge: vi.fn(),
  mockSendEmail: vi.fn(),
}));

vi.mock("@/lib/api-utils", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/account-reauth", () => ({
  createAccountDeletionChallenge: mockCreateChallenge,
  verifyAccountDeletionChallenge: mockVerifyChallenge,
}));
vi.mock("@/lib/email", () => ({
  isEmailDeliveryError: () => false,
  sendAccountReauthenticationEmail: mockSendEmail,
}));

import { POST } from "@/app/api/users/me/reauthenticate/route";
import { GET } from "@/app/api/users/me/reauthenticate/verify/route";

describe("POST /api/users/me/reauthenticate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      session: { user: { id: "user-1", tokenVersion: 2 } },
      error: null,
    });
  });

  it("rejects an account without a verified email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      emailVerified: null,
      tokenVersion: 2,
    });

    const response = await POST();

    expect(response.status).toBe(403);
    expect(mockCreateChallenge).not.toHaveBeenCalled();
  });

  it("redirects a valid challenge to settings with a one-time proof id", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      emailVerified: new Date(),
      tokenVersion: 2,
    });
    mockVerifyChallenge.mockResolvedValue({ ok: true, challengeId: "challenge-1" });

    const response = await GET(
      new NextRequest("http://localhost:3000/api/users/me/reauthenticate/verify?token=raw-token")
    );

    expect(response.headers.get("location")).toContain(
      "/settings?reauthVerified=true&reauthChallengeId=challenge-1"
    );
  });

  it("creates a challenge and sends the reauthentication email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      emailVerified: new Date(),
      tokenVersion: 2,
    });
    mockCreateChallenge.mockResolvedValue({
      id: "challenge-1",
      token: "raw-token",
      expiresAt: new Date("2026-01-01T00:10:00.000Z"),
    });
    mockSendEmail.mockResolvedValue({ sent: true, provider: "smtp" });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ success: true, challengeId: "challenge-1" });
    expect(JSON.stringify(data)).not.toContain("raw-token");
    expect(mockSendEmail).toHaveBeenCalledWith("user@example.com", "raw-token");
  });
});
