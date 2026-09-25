// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma, mockRequireAuth } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    block: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
    connection: { deleteMany: vi.fn() },
    teamInvite: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/api-utils", () => ({
  requireAuth: mockRequireAuth,
  internalError: () => Response.json({ error: "internal" }, { status: 500 }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/security-events", () => ({ logSecurityEvent: vi.fn() }));

import { DELETE, POST } from "@/app/api/users/[id]/block/route";

const params = Promise.resolve({ id: "user-2" });
const request = () => new NextRequest("http://localhost/api/users/user-2/block");

describe("block user endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ session: { user: { id: "user-1" } }, error: null });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-2" });
    mockPrisma.block.findFirst.mockResolvedValue(null);
    mockPrisma.block.create.mockResolvedValue({ id: "block-1" });
    mockPrisma.block.delete.mockResolvedValue({ id: "block-1" });
    mockPrisma.connection.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.teamInvite.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.$transaction.mockResolvedValue([]);
  });

  it("removes connections and pending invites when blocking", async () => {
    const response = await POST(request(), { params });

    expect(response.status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({}),
      expect.objectContaining({}),
      expect.objectContaining({}),
    ]));
  });

  it("allows an explicit unblock", async () => {
    mockPrisma.block.findFirst.mockResolvedValue({ id: "block-1" });

    const response = await DELETE(request(), { params });

    expect(response.status).toBe(200);
    expect(mockPrisma.block.delete).toHaveBeenCalledWith({ where: { id: "block-1" } });
  });
});
