// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "@/test/api-helpers";

const { mockPrisma, mockGetServerSession } = vi.hoisted(() => {
  const fn = () => vi.fn();
  const model = () => ({
    findUnique: fn(), findFirst: fn(), findMany: fn(),
    create: fn(), update: fn(), delete: fn(), count: fn(),
  });
  return {
    mockPrisma: {
      user: model(),
      conversation: model(),
      connection: model(),
      message: model(),
    },
    mockGetServerSession: fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: (...args: unknown[]) => mockGetServerSession(...args) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { GET, POST } from "@/app/api/conversations/route";

describe("GET /api/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/conversations");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns conversations with other participant and unread count", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    const mockConversations = [
      {
        id: "conv-1",
        participant1Id: "test-user-id",
        participant2Id: "other-user-id",
        participant1: { id: "test-user-id", name: "Test", username: "test", avatar: null },
        participant2: { id: "other-user-id", name: "Other", username: "other", avatar: null },
        lastMessageAt: new Date("2026-01-01"),
        lastMessagePreview: "Hello!",
        messages: [{ id: "msg-1" }, { id: "msg-2" }],
        createdAt: new Date("2026-01-01"),
      },
    ];
    mockPrisma.conversation.findMany.mockResolvedValue(mockConversations);

    const request = new Request("http://localhost:3000/api/conversations");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversations).toHaveLength(1);
    expect(data.conversations[0].otherParticipant.id).toBe("other-user-id");
    expect(data.conversations[0].unreadCount).toBe(2);
    expect(data.nextCursor).toBeNull();
  });

  it("returns nextCursor when results match limit", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    const mockConversations = Array.from({ length: 2 }, (_, i) => ({
      id: `conv-${i + 1}`,
      participant1Id: "test-user-id",
      participant2Id: `user-${i}`,
      participant1: { id: "test-user-id", name: "Test", username: "test", avatar: null },
      participant2: { id: `user-${i}`, name: `User ${i}`, username: `user${i}`, avatar: null },
      lastMessageAt: new Date(),
      lastMessagePreview: "msg",
      messages: [],
      createdAt: new Date(),
    }));
    mockPrisma.conversation.findMany.mockResolvedValue(mockConversations);

    const request = new Request("http://localhost:3000/api/conversations?limit=2");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nextCursor).toBe("conv-2");
  });

  it("identifies other participant when user is participant2", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    const mockConversations = [
      {
        id: "conv-1",
        participant1Id: "other-user-id",
        participant2Id: "test-user-id",
        participant1: { id: "other-user-id", name: "Other", username: "other", avatar: null },
        participant2: { id: "test-user-id", name: "Test", username: "test", avatar: null },
        lastMessageAt: null,
        lastMessagePreview: null,
        messages: [],
        createdAt: new Date(),
      },
    ];
    mockPrisma.conversation.findMany.mockResolvedValue(mockConversations);

    const request = new Request("http://localhost:3000/api/conversations");
    const response = await GET(request);
    const data = await response.json();

    expect(data.conversations[0].otherParticipant.id).toBe("other-user-id");
  });
});

describe("POST /api/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: "other-user" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 when trying to create conversation with self", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    const request = new Request("http://localhost:3000/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: "test-user-id" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("returns 404 when participant does not exist", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: "nonexistent" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBeDefined();
  });

  it("returns 403 when no accepted connection exists", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.user.findUnique.mockResolvedValue({ id: "other-user" });
    mockPrisma.connection.findFirst.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: "other-user" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBeDefined();
  });

  it("returns existing conversation if one already exists", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.user.findUnique.mockResolvedValue({ id: "other-user" });
    mockPrisma.connection.findFirst.mockResolvedValue({
      id: "conn-1", status: "ACCEPTED",
      senderId: "test-user-id", receiverId: "other-user",
    });

    const existingConv = {
      id: "existing-conv",
      participant1Id: "test-user-id",
      participant2Id: "other-user",
      participant1: { id: "test-user-id", name: "Test", username: "test", avatar: null },
      participant2: { id: "other-user", name: "Other", username: "other", avatar: null },
      lastMessageAt: new Date("2026-01-01"),
      lastMessagePreview: "Hi",
      createdAt: new Date("2026-01-01"),
    };
    mockPrisma.conversation.findFirst.mockResolvedValue(existingConv);

    const request = new Request("http://localhost:3000/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: "other-user" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.isNew).toBe(false);
    expect(data.conversation.id).toBe("existing-conv");
    expect(data.conversation.otherParticipant.id).toBe("other-user");
  });

  it("creates new conversation and returns 201", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.user.findUnique.mockResolvedValue({ id: "other-user" });
    mockPrisma.connection.findFirst.mockResolvedValue({
      id: "conn-1", status: "ACCEPTED",
      senderId: "test-user-id", receiverId: "other-user",
    });
    mockPrisma.conversation.findFirst.mockResolvedValue(null);

    const newConv = {
      id: "new-conv",
      participant1Id: "test-user-id",
      participant2Id: "other-user",
      participant1: { id: "test-user-id", name: "Test", username: "test", avatar: null },
      participant2: { id: "other-user", name: "Other", username: "other", avatar: null },
      lastMessageAt: null,
      lastMessagePreview: null,
      createdAt: new Date("2026-02-01"),
    };
    mockPrisma.conversation.create.mockResolvedValue(newConv);

    const request = new Request("http://localhost:3000/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: "other-user" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.isNew).toBe(true);
    expect(data.conversation.id).toBe("new-conv");
    expect(data.conversation.otherParticipant.id).toBe("other-user");
    expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          participant1Id: "test-user-id",
          participant2Id: "other-user",
        },
      })
    );
  });

  it("returns 400 for missing participantId", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    const request = new Request("http://localhost:3000/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
