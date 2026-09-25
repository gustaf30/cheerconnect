// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "@/test/api-helpers";

const { mockPrisma, mockGetServerSession } = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    mockPrisma: {
      conversation: { findUnique: fn(), create: fn(), update: fn() },
      message: { findMany: fn(), findFirst: fn(), create: fn(), updateMany: fn() },
      user: { findUnique: fn() },
      connection: { findFirst: fn() },
      block: { findFirst: fn(), findMany: fn() },
      notification: { create: fn() },
      $transaction: fn(),
    },
    mockGetServerSession: fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: (...args: unknown[]) => mockGetServerSession(...args) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/realtime-bus", () => ({ publishRealtimeEvent: vi.fn() }));

import { GET, POST } from "@/app/api/conversations/[id]/messages/route";

const params = { params: Promise.resolve({ id: "conversation-1" }) };

function conversation() {
  return {
    id: "conversation-1",
    participant1Id: "test-user-id",
    participant2Id: "other-user",
    participant1: { id: "test-user-id", name: "Test", username: "test", avatar: null },
    participant2: { id: "other-user", name: "Other", username: "other", avatar: null },
    lastMessageAt: null,
    lastMessagePreview: null,
    createdAt: new Date(),
  };
}

describe("conversation messages API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.conversation.findUnique.mockResolvedValue(conversation());
    mockPrisma.block.findFirst.mockResolvedValue(null);
  });

  it("returns the newest messages first for initial pagination", async () => {
    mockPrisma.message.findMany.mockResolvedValue([
      { id: "new", content: "new", senderId: "other-user", createdAt: new Date("2026-01-02"), sender: {} },
      { id: "old", content: "old", senderId: "test-user-id", createdAt: new Date("2026-01-01"), sender: {} },
    ]);
    const response = await GET(new Request("http://localhost/api/conversations/conversation-1/messages"), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.message.findMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(body.messages[0].id).toBe("new");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("blocks sending when the connection was removed after the conversation was created", async () => {
    mockPrisma.connection.findFirst.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/conversations/conversation-1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "hello" }),
    }), params);

    expect(response.status).toBe(403);
    expect(mockPrisma.message.create).not.toHaveBeenCalled();
  });
});
