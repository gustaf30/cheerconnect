// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { mockPrisma, mockRequireAuth } = vi.hoisted(() => ({
  mockPrisma: {
    user: { update: vi.fn(), count: vi.fn() },
  },
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/api-utils", () => ({
  requireAuth: mockRequireAuth,
  handleZodError: () => null,
  internalError: () => NextResponse.json({ error: "internal" }, { status: 500 }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { PATCH } from "@/app/api/settings/route";

describe("PATCH /api/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ session: { user: { id: "user-1" } }, error: null });
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.user.update.mockResolvedValue({
      email: "user@example.com",
      emailVerified: new Date(),
      username: "user",
      usernameChangedAt: new Date(),
      notifyPostLiked: true,
      notifyPostCommented: true,
      notifyConnectionRequest: true,
      notifyConnectionAccepted: true,
      notifyCommentReplied: true,
      notifyMessageReceived: true,
      notifyPostReposted: true,
      notifyTeamInvite: true,
      notifyMention: false,
      profileVisibility: "PUBLIC",
      showEmail: false,
    });
  });

  it("returns the complete settings contract after updating notifications", async () => {
    const response = await PATCH(new Request("http://localhost/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifications: { mention: false } }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings).toEqual(expect.objectContaining({
      emailVerified: true,
      hasPassword: true,
      canChangeUsername: expect.any(Boolean),
      notifications: expect.objectContaining({ mention: false }),
    }));
    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { notifyMention: false },
    }));
  });
});
