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
      achievement: model(),
      user: model(),
      connection: model(),
      block: { findFirst: fn(), findMany: fn() },
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

import { GET, POST } from "@/app/api/achievements/route";
import { PATCH, DELETE } from "@/app/api/achievements/[id]/route";

const OTHER_USER = "outro-usuario";
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function postRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/achievements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchRequest(id: string, body: Record<string, unknown>) {
  return new Request(`http://localhost:3000/api/achievements/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validAchievement = {
  title: "Campeonato Nacional 2025",
  description: "Primeira colocada na_divisão",
  date: "2025-06-20T00:00:00.000Z",
  category: "Competição",
};

describe("GET /api/achievements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.block.findMany.mockResolvedValue([]);
    mockPrisma.connection.findMany.mockResolvedValue([]);
    mockPrisma.achievement.findMany.mockResolvedValue([]);
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost:3000/api/achievements"));

    expect(response.status).toBe(401);
    expect(mockPrisma.achievement.findMany).not.toHaveBeenCalled();
  });

  it("defaults to the session user and skips the visibility check for self", async () => {
    const response = await GET(new Request("http://localhost:3000/api/achievements"));
    const query = mockPrisma.achievement.findMany.mock.calls[0][0];

    expect(response.status).toBe(200);
    expect(query.where).toEqual({ userId: "test-user-id" });
    // Sem isso a rota buscaria o próprio perfil e exigiria conexão consigo mesmo.
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("answers 404 rather than 403 for a blocked user, so existence is not confirmed", async () => {
    mockPrisma.block.findMany
      .mockResolvedValueOnce([{ blockedUserId: OTHER_USER }])
      .mockResolvedValueOnce([]);

    const response = await GET(
      new Request(`http://localhost:3000/api/achievements?userId=${OTHER_USER}`),
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.achievement.findMany).not.toHaveBeenCalled();
  });

  it("answers 404 for a user that does not exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const response = await GET(
      new Request(`http://localhost:3000/api/achievements?userId=${OTHER_USER}`),
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.achievement.findMany).not.toHaveBeenCalled();
  });

  it("answers 403 for a private profile with no accepted connection", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ profileVisibility: "PRIVATE" });

    const response = await GET(
      new Request(`http://localhost:3000/api/achievements?userId=${OTHER_USER}`),
    );

    expect(response.status).toBe(403);
    expect(mockPrisma.achievement.findMany).not.toHaveBeenCalled();
  });

  it("allows a connected user to read a private profile", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ profileVisibility: "PRIVATE" });
    mockPrisma.connection.findMany.mockResolvedValue([
      { senderId: "test-user-id", receiverId: OTHER_USER },
    ]);

    const response = await GET(
      new Request(`http://localhost:3000/api/achievements?userId=${OTHER_USER}`),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.achievement.findMany.mock.calls[0][0].where).toEqual({ userId: OTHER_USER });
  });

  it("allows a public profile without a connection", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ profileVisibility: "PUBLIC" });

    const response = await GET(
      new Request(`http://localhost:3000/api/achievements?userId=${OTHER_USER}`),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.connection.findMany).not.toHaveBeenCalled();
  });

  it("orders by date and reads one extra row for the cursor", async () => {
    mockPrisma.achievement.findMany.mockResolvedValue([{ id: "a1" }, { id: "a2" }, { id: "a3" }]);

    const data = await (
      await GET(new Request("http://localhost:3000/api/achievements?limit=2"))
    ).json();
    const query = mockPrisma.achievement.findMany.mock.calls[0][0];

    expect(query.orderBy).toEqual([{ date: "desc" }, { id: "desc" }]);
    expect(query.take).toBe(3);
    expect(data.achievements).toHaveLength(2);
    expect(data.nextCursor).toBe("a2");
  });
});

describe("POST /api/achievements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.achievement.create.mockResolvedValue({ id: "a1" });
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await POST(postRequest(validAchievement));

    expect(response.status).toBe(401);
    expect(mockPrisma.achievement.create).not.toHaveBeenCalled();
  });

  it("stores the achievement for the session user and answers 201", async () => {
    const response = await POST(postRequest(validAchievement));

    expect(response.status).toBe(201);
    expect(mockPrisma.achievement.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ userId: "test-user-id", title: "Campeonato Nacional 2025" }),
    );
  });

  it("refuses an empty title", async () => {
    const response = await POST(postRequest({ ...validAchievement, title: "   " }));

    expect(response.status).toBe(400);
    expect(mockPrisma.achievement.create).not.toHaveBeenCalled();
  });

  it("refuses a missing date", async () => {
    const { date: _omitted, ...withoutDate } = validAchievement;

    const response = await POST(postRequest(withoutDate));

    expect(response.status).toBe(400);
    expect(mockPrisma.achievement.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/achievements/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.achievement.findFirst.mockResolvedValue({ id: "a1" });
    mockPrisma.achievement.update.mockResolvedValue({ id: "a1" });
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await PATCH(patchRequest("a1", { title: "Outro" }), params("a1"));

    expect(response.status).toBe(401);
    expect(mockPrisma.achievement.update).not.toHaveBeenCalled();
  });

  it("updates an achievement owned by the session user", async () => {
    const response = await PATCH(patchRequest("a1", { title: "Título novo" }), params("a1"));

    expect(response.status).toBe(200);
    expect(mockPrisma.achievement.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { title: "Título novo" },
    });
  });

  it("answers 404 without updating an achievement owned by someone else", async () => {
    mockPrisma.achievement.findFirst.mockResolvedValue(null);

    const response = await PATCH(patchRequest("a1", { title: "Título novo" }), params("a1"));

    expect(response.status).toBe(404);
    expect(mockPrisma.achievement.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/achievements/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost:3000/api/achievements/a1", { method: "DELETE" }),
      params("a1"),
    );

    expect(response.status).toBe(401);
    expect(mockPrisma.achievement.delete).not.toHaveBeenCalled();
  });

  it("deletes the achievement owned by the session user", async () => {
    mockPrisma.achievement.findFirst.mockResolvedValue({ id: "a1" });

    const response = await DELETE(
      new Request("http://localhost:3000/api/achievements/a1", { method: "DELETE" }),
      params("a1"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockPrisma.achievement.delete).toHaveBeenCalledWith({ where: { id: "a1" } });
  });

  it("answers 404 without deleting an achievement owned by someone else", async () => {
    mockPrisma.achievement.findFirst.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost:3000/api/achievements/a1", { method: "DELETE" }),
      params("a1"),
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.achievement.delete).not.toHaveBeenCalled();
  });
});
