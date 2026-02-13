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
      post: model(),
      connection: model(),
      team: model(),
      teamMember: model(),
      teamFollow: { findMany: fn() },
      notification: { create: fn(), findMany: fn() },
      tag: { upsert: fn() },
      postTag: { create: fn(), deleteMany: fn() },
      mention: { create: fn(), deleteMany: fn() },
      block: { findFirst: fn(), findMany: fn() },
      $transaction: fn(),
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

import { GET, POST } from "@/app/api/connections/route";

describe("GET /api/connections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/connections");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns formatted connections for authenticated user", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);
    mockPrisma.block.findMany.mockResolvedValue([]);

    const mockConnections = [
      {
        id: "conn-1",
        status: "ACCEPTED",
        createdAt: new Date(),
        updatedAt: new Date(),
        senderId: "test-user-id",
        receiverId: "other-user-id",
        sender: { id: "test-user-id", name: "Test", username: "testuser", avatar: null, positions: [], location: null },
        receiver: { id: "other-user-id", name: "Other", username: "other", avatar: null, positions: [], location: null },
      },
    ];
    mockPrisma.connection.findMany.mockResolvedValue(mockConnections);

    const request = new Request("http://localhost:3000/api/connections?status=ACCEPTED");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.connections).toHaveLength(1);
    expect(data.connections[0].user.id).toBe("other-user-id");
    expect(data.connections[0].isSender).toBe(true);
  });

  it("filters out connections with blocked users", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.block.findMany
      .mockResolvedValueOnce([{ blockedUserId: "blocked-user-id" }])
      .mockResolvedValueOnce([]);

    const mockConnections = [
      {
        id: "conn-1", status: "ACCEPTED", createdAt: new Date(), updatedAt: new Date(),
        senderId: "test-user-id", receiverId: "blocked-user-id",
        sender: { id: "test-user-id", name: "Test", username: "testuser", avatar: null, positions: [], location: null },
        receiver: { id: "blocked-user-id", name: "Blocked", username: "blocked", avatar: null, positions: [], location: null },
      },
      {
        id: "conn-2", status: "ACCEPTED", createdAt: new Date(), updatedAt: new Date(),
        senderId: "test-user-id", receiverId: "good-user-id",
        sender: { id: "test-user-id", name: "Test", username: "testuser", avatar: null, positions: [], location: null },
        receiver: { id: "good-user-id", name: "Good", username: "good", avatar: null, positions: [], location: null },
      },
    ];
    mockPrisma.connection.findMany.mockResolvedValue(mockConnections);

    const request = new Request("http://localhost:3000/api/connections");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.connections).toHaveLength(1);
    expect(data.connections[0].user.id).toBe("good-user-id");
  });
});

describe("POST /api/connections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // $transaction executes the callback with mockPrisma
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma));
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: "some-id" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 for self-connection", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    const request = new Request("http://localhost:3000/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: "test-user-id" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("returns 404 when receiver does not exist", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: "nonexistent-id" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(404);
  });

  it("returns 400 for duplicate connection request", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.user.findUnique.mockResolvedValue({ id: "other-user-id" });
    mockPrisma.connection.findFirst.mockResolvedValue({
      id: "existing-conn",
      senderId: "test-user-id",
      receiverId: "other-user-id",
      status: "PENDING",
    });

    const request = new Request("http://localhost:3000/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: "other-user-id" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("creates connection and notification when receiver allows it", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    // First call: receiver exists check
    // Then Promise.all: currentUser (name+username) and receiverPrefs (notifyConnectionRequest)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: "other-user-id" })
      .mockResolvedValueOnce({ name: "Test User", username: "testuser" })
      .mockResolvedValueOnce({ notifyConnectionRequest: true });

    mockPrisma.connection.findFirst.mockResolvedValue(null);

    const newConnection = {
      id: "new-conn-id",
      senderId: "test-user-id",
      receiverId: "other-user-id",
      status: "PENDING",
    };
    mockPrisma.connection.create.mockResolvedValue(newConnection);
    mockPrisma.notification.create.mockResolvedValue({});

    const request = new Request("http://localhost:3000/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: "other-user-id" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.connection.id).toBe("new-conn-id");

    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "other-user-id",
          type: "CONNECTION_REQUEST",
          actorId: "test-user-id",
        }),
      })
    );
  });

  it("does not create notification when receiver has notifications disabled", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: "other-user-id" })
      .mockResolvedValueOnce({ name: "Test User", username: "testuser" })
      .mockResolvedValueOnce({ notifyConnectionRequest: false });

    mockPrisma.connection.findFirst.mockResolvedValue(null);
    mockPrisma.connection.create.mockResolvedValue({
      id: "new-conn-id",
      senderId: "test-user-id",
      receiverId: "other-user-id",
      status: "PENDING",
    });

    const request = new Request("http://localhost:3000/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: "other-user-id" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });
});
