// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "@/test/api-helpers";

const { mockPrisma, mockGetServerSession } = vi.hoisted(() => {
  const fn = () => vi.fn();
  const model = () => ({
    findUnique: fn(), findFirst: fn(), findMany: fn(),
    create: fn(), update: fn(), delete: fn(), deleteMany: fn(), count: fn(),
  });
  return {
    mockPrisma: {
      user: model(),
      post: model(),
      like: model(),
      notification: { create: fn(), findMany: fn() },
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

import { POST, DELETE } from "@/app/api/posts/[id]/like/route";

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/posts/[id]/like", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/posts/post-1/like", { method: "POST" });
    const response = await POST(request, makeParams("post-1"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when post does not exist", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);
    mockPrisma.post.findUnique.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/posts/nonexistent/like", { method: "POST" });
    const response = await POST(request, makeParams("nonexistent"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBeDefined();
  });

  it("returns 400 when post is already liked", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.post.findUnique.mockResolvedValue({
      id: "post-1",
      authorId: "other-user",
      author: { id: "other-user" },
    });
    mockPrisma.like.findUnique.mockResolvedValue({ id: "like-1", userId: "test-user-id", postId: "post-1" });

    const request = new Request("http://localhost:3000/api/posts/post-1/like", { method: "POST" });
    const response = await POST(request, makeParams("post-1"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("creates like and returns success", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.post.findUnique.mockResolvedValue({
      id: "post-1",
      authorId: "other-user",
      author: { id: "other-user" },
    });
    mockPrisma.like.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ name: "Test User" })
      .mockResolvedValueOnce({ notifyPostLiked: true });
    mockPrisma.like.create.mockResolvedValue({ id: "like-1", userId: "test-user-id", postId: "post-1" });
    mockPrisma.notification.create.mockResolvedValue({});

    const request = new Request("http://localhost:3000/api/posts/post-1/like", { method: "POST" });
    const response = await POST(request, makeParams("post-1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.like.create).toHaveBeenCalledWith({
      data: { userId: "test-user-id", postId: "post-1" },
    });
  });

  it("creates notification for post author when enabled", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.post.findUnique.mockResolvedValue({
      id: "post-1",
      authorId: "author-user",
      author: { id: "author-user" },
    });
    mockPrisma.like.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ name: "Test User" })
      .mockResolvedValueOnce({ notifyPostLiked: true });
    mockPrisma.like.create.mockResolvedValue({});
    mockPrisma.notification.create.mockResolvedValue({});

    const request = new Request("http://localhost:3000/api/posts/post-1/like", { method: "POST" });
    await POST(request, makeParams("post-1"));

    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "author-user",
          type: "POST_LIKED",
          actorId: "test-user-id",
        }),
      })
    );
  });

  it("does not create notification when liking own post", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.post.findUnique.mockResolvedValue({
      id: "post-1",
      authorId: "test-user-id",
      author: { id: "test-user-id" },
    });
    mockPrisma.like.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ name: "Test User" })
      .mockResolvedValueOnce({ notifyPostLiked: true });
    mockPrisma.like.create.mockResolvedValue({});

    const request = new Request("http://localhost:3000/api/posts/post-1/like", { method: "POST" });
    const response = await POST(request, makeParams("post-1"));

    expect(response.status).toBe(200);
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  it("does not create notification when author has notifications disabled", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.post.findUnique.mockResolvedValue({
      id: "post-1",
      authorId: "author-user",
      author: { id: "author-user" },
    });
    mockPrisma.like.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ name: "Test User" })
      .mockResolvedValueOnce({ notifyPostLiked: false });
    mockPrisma.like.create.mockResolvedValue({});

    const request = new Request("http://localhost:3000/api/posts/post-1/like", { method: "POST" });
    const response = await POST(request, makeParams("post-1"));

    expect(response.status).toBe(200);
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/posts/[id]/like", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/posts/post-1/like", { method: "DELETE" });
    const response = await DELETE(request, makeParams("post-1"));

    expect(response.status).toBe(401);
  });

  it("removes like and returns success", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.like.deleteMany.mockResolvedValue({ count: 1 });

    const request = new Request("http://localhost:3000/api/posts/post-1/like", { method: "DELETE" });
    const response = await DELETE(request, makeParams("post-1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.like.deleteMany).toHaveBeenCalledWith({
      where: { userId: "test-user-id", postId: "post-1" },
    });
  });

  it("returns 404 when post was not liked", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.like.deleteMany.mockResolvedValue({ count: 0 });

    const request = new Request("http://localhost:3000/api/posts/post-1/like", { method: "DELETE" });
    const response = await DELETE(request, makeParams("post-1"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBeDefined();
  });
});
