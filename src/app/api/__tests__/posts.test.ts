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

import { GET, POST } from "@/app/api/posts/route";

describe("GET /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/posts");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns posts with pagination cursor", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.block.findMany.mockResolvedValue([]);
    mockPrisma.connection.findMany.mockResolvedValue([]);
    mockPrisma.teamFollow.findMany.mockResolvedValue([]);

    const mockPosts = [
      {
        id: "post-1",
        content: "Test post",
        authorId: "test-user-id",
        author: { id: "test-user-id", name: "Test", username: "test", avatar: null, positions: [] },
        team: null,
        originalPost: null,
        _count: { likes: 0, comments: 0, reposts: 0 },
        likes: [],
        createdAt: new Date(),
      },
    ];
    mockPrisma.post.findMany.mockResolvedValue(mockPosts);

    const request = new Request("http://localhost:3000/api/posts?filter=following");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].id).toBe("post-1");
    expect(data.posts[0].isLiked).toBe(false);
    expect(data.nextCursor).toBeNull();
  });

  it("returns nextCursor when results match limit", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);
    mockPrisma.block.findMany.mockResolvedValue([]);
    mockPrisma.connection.findMany.mockResolvedValue([]);
    mockPrisma.teamFollow.findMany.mockResolvedValue([]);

    const mockPosts = [
      {
        id: "post-1", content: "A", authorId: "u1",
        author: { id: "u1", name: "A", username: "a", avatar: null, positions: [] },
        team: null, originalPost: null,
        _count: { likes: 0, comments: 0, reposts: 0 }, likes: [], createdAt: new Date(),
      },
      {
        id: "post-2", content: "B", authorId: "u1",
        author: { id: "u1", name: "A", username: "a", avatar: null, positions: [] },
        team: null, originalPost: null,
        _count: { likes: 0, comments: 0, reposts: 0 }, likes: [], createdAt: new Date(),
      },
    ];
    mockPrisma.post.findMany.mockResolvedValue(mockPosts);

    const request = new Request("http://localhost:3000/api/posts?limit=2&filter=all");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nextCursor).toBe("post-2");
  });
});

describe("POST /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Hello" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 for empty content", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    const request = new Request("http://localhost:3000/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("creates a post and returns 200 with post data", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    const mockPost = {
      id: "new-post-id",
      content: "Hello world",
      images: [],
      videoUrl: null,
      authorId: "test-user-id",
      teamId: null,
      author: { id: "test-user-id", name: "Test User", username: "testuser", avatar: null, positions: [] },
      _count: { likes: 0, comments: 0 },
      createdAt: new Date(),
    };
    mockPrisma.post.create.mockResolvedValue(mockPost);

    const request = new Request("http://localhost:3000/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Hello world" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.post.id).toBe("new-post-id");
    expect(data.post.content).toBe("Hello world");
    expect(data.post.isLiked).toBe(false);
  });

  it("extracts hashtags when creating a post", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    const mockPost = {
      id: "post-with-tags",
      content: "Check out #cheerleading and #competition",
      images: [],
      videoUrl: null,
      authorId: "test-user-id",
      teamId: null,
      author: { id: "test-user-id", name: "Test User", username: "testuser", avatar: null, positions: [] },
      _count: { likes: 0, comments: 0 },
      createdAt: new Date(),
    };
    mockPrisma.post.create.mockResolvedValue(mockPost);

    const txTag = { upsert: vi.fn() };
    const txPostTag = { create: vi.fn() };
    const txUser = { findMany: vi.fn().mockResolvedValue([]) };
    const txMention = { create: vi.fn(), deleteMany: vi.fn() };

    txTag.upsert.mockResolvedValueOnce({ id: "tag-1", name: "cheerleading" });
    txTag.upsert.mockResolvedValueOnce({ id: "tag-2", name: "competition" });

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      return fn({
        tag: txTag,
        postTag: txPostTag,
        user: txUser,
        mention: txMention,
        notification: { create: vi.fn() },
      });
    });

    const request = new Request("http://localhost:3000/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Check out #cheerleading and #competition" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(txTag.upsert).toHaveBeenCalledTimes(2);
    expect(txTag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "cheerleading" } })
    );
    expect(txTag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "competition" } })
    );
    expect(txPostTag.create).toHaveBeenCalledTimes(2);
  });

  it("does not trigger transaction when no hashtags or mentions", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    const mockPost = {
      id: "plain-post",
      content: "No tags here",
      images: [],
      videoUrl: null,
      authorId: "test-user-id",
      teamId: null,
      author: { id: "test-user-id", name: "Test User", username: "testuser", avatar: null, positions: [] },
      _count: { likes: 0, comments: 0 },
      createdAt: new Date(),
    };
    mockPrisma.post.create.mockResolvedValue(mockPost);

    const request = new Request("http://localhost:3000/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "No tags here" }),
    });
    await POST(request);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
