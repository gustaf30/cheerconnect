// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockCompare } = vi.hoisted(() => ({
  mockPrisma: { user: { findUnique: vi.fn() } },
  mockCompare: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn((options) => ({ id: "google", ...options })) }));
vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((options) => ({ id: "credentials", ...options })),
}));
vi.mock("bcryptjs", () => ({ default: { compare: mockCompare } }));
vi.mock("@/lib/logger", () => ({ default: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/security-events", () => ({ logSecurityEvent: vi.fn() }));

import { authOptions } from "@/lib/auth";

describe("credentials authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an account whose email is not verified", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      password: "hash",
      emailVerified: null,
      tokenVersion: 0,
    });
    mockCompare.mockResolvedValue(true);

    const provider = authOptions.providers.find((item) => item.id === "credentials");
    const authorize = (provider as unknown as { authorize: (credentials?: Record<string, string>) => Promise<unknown> }).authorize;

    await expect(authorize({ email: "user@example.com", password: "Password123" })).rejects.toThrow(
      "Verifique seu email"
    );
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it("returns the user after password verification for a verified account", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      password: "hash",
      emailVerified: new Date(),
      tokenVersion: 0,
    });
    mockCompare.mockResolvedValue(true);

    const provider = authOptions.providers.find((item) => item.id === "credentials");
    const authorize = (provider as unknown as { authorize: (credentials?: Record<string, string>) => Promise<unknown> }).authorize;

    await expect(authorize({ email: "user@example.com", password: "Password123" })).resolves.toMatchObject({
      id: "user-1",
      email: "user@example.com",
    });
  });

  it("builds a unique username for a new Google account", () => {
    const provider = authOptions.providers.find((item) => item.id === "google");
    const profile = (provider as unknown as { profile: (value: Record<string, string>) => { username: string } }).profile;

    expect(profile({
      sub: "google-user-123456",
      email: "First.Last+cheer@example.com",
      email_verified: "true",
    })).toMatchObject({
      username: "first_last_cheer_123456",
    });
  });

  it("rejects a new Google account when email_verified is false", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const signIn = authOptions.callbacks?.signIn;
    if (!signIn) throw new Error("signIn callback missing");

    await expect(
      signIn({
        user: { id: "new-user" },
        account: { provider: "google" },
        profile: { email_verified: "false" },
      } as never)
    ).resolves.toBe(false);
  });

  it("accepts a new Google account only when email_verified is true", async () => {
    const signIn = authOptions.callbacks?.signIn;
    if (!signIn) throw new Error("signIn callback missing");

    await expect(
      signIn({
        user: { id: "new-user" },
        account: { provider: "google" },
        profile: { email_verified: true },
      } as never)
    ).resolves.toBe(true);
  });
});
