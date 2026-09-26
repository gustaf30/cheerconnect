// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSession } from "@/test/api-helpers";

const { mockPrisma, mockGetServerSession, mockPublish } = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    mockPrisma: {
      comment: { findUnique: fn(), findMany: fn(), update: fn(), delete: fn() },
      commentLike: { create: fn(), deleteMany: fn() },
      block: { findFirst: fn(), findMany: fn() },
    },
    mockGetServerSession: fn(),
    mockPublish: fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: (...args: unknown[]) => mockGetServerSession(...args) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/realtime-bus", () => ({ publishRealtimeEvent: mockPublish }));

import { PATCH, DELETE } from "@/app/api/comments/[id]/route";
import { POST as LIKE_POST, DELETE as LIKE_DELETE } from "@/app/api/comments/[id]/like/route";
import { GET as REPLIES_GET } from "@/app/api/comments/[id]/replies/route";

const COMMENT_ID = "c1";
const OTHER = "outro-usuario";
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function patchRequest(body: Record<string, unknown>) {
  // A rota tipa o PATCH como NextRequest, então o teste precisa construir um.
  return new NextRequest(`http://localhost:3000/api/comments/${COMMENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/comments/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.comment.findUnique.mockResolvedValue({ id: COMMENT_ID, authorId: "test-user-id" });
    mockPrisma.comment.update.mockResolvedValue({
      id: COMMENT_ID,
      content: "texto novo",
      createdAt: new Date("2026-09-20T10:00:00.000Z"),
      updatedAt: new Date("2026-09-26T10:00:00.000Z"),
      author: { id: "test-user-id" },
      _count: { likes: 2 },
    });
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ content: "x" }), params(COMMENT_ID));

    expect(response.status).toBe(401);
    expect(mockPrisma.comment.update).not.toHaveBeenCalled();
  });

  it("edits the comment of the session user and returns it with the like count", async () => {
    const response = await PATCH(patchRequest({ content: "texto novo" }), params(COMMENT_ID));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.comment).toEqual({
      id: COMMENT_ID,
      content: "texto novo",
      createdAt: "2026-09-20T10:00:00.000Z",
      updatedAt: "2026-09-26T10:00:00.000Z",
      author: { id: "test-user-id" },
      likesCount: 2,
    });
  });

  it("keeps createdAt distinct from updatedAt, so the client can show 'edited'", async () => {
    await PATCH(patchRequest({ content: "texto novo" }), params(COMMENT_ID));
    const response = await PATCH(patchRequest({ content: "outro" }), params(COMMENT_ID));
    const data = await response.json();

    // O banco devolve os dois campos, mas a rota precisa repassá-los separadamente:
    // se createdAt fosse reescrito com updatedAt, o cliente perderia a noção de
    // quando o comentário foi originalmente publicado.
    expect(data.comment.createdAt).not.toBe(data.comment.updatedAt);
  });

  it("only forwards the content, ignoring any other field sent by the client", async () => {
    await PATCH(patchRequest({ content: "texto", authorId: OTHER, id: "hack" }), params(COMMENT_ID));

    expect(mockPrisma.comment.update.mock.calls[0][0].data).toEqual({ content: "texto" });
  });

  it("answers 404 for a comment that does not exist", async () => {
    mockPrisma.comment.findUnique.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ content: "x" }), params(COMMENT_ID));

    expect(response.status).toBe(404);
    expect(mockPrisma.comment.update).not.toHaveBeenCalled();
  });

  it("answers 403 for a comment written by someone else", async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ id: COMMENT_ID, authorId: OTHER });

    const response = await PATCH(patchRequest({ content: "x" }), params(COMMENT_ID));

    expect(response.status).toBe(403);
    expect(mockPrisma.comment.update).not.toHaveBeenCalled();
  });

  it("refuses an empty content", async () => {
    const response = await PATCH(patchRequest({ content: "" }), params(COMMENT_ID));

    expect(response.status).toBe(400);
    expect(mockPrisma.comment.update).not.toHaveBeenCalled();
  });

  it("refuses a content longer than 2000 characters", async () => {
    const response = await PATCH(patchRequest({ content: "a".repeat(2001) }), params(COMMENT_ID));

    expect(response.status).toBe(400);
    expect(mockPrisma.comment.update).not.toHaveBeenCalled();
  });

  it("documents that a whitespace-only comment is accepted", async () => {
    // Lacuna conhecida, e inconsistente com o resto do projeto: o schema de
    // comentário usa min(1) sem .trim(), enquanto career e events aplicam
    // .trim() antes do .min(). O resultado é que um comentário só com espaços
    // passa pela validação. Este teste existe para fixar o comportamento atual
    // e para falhar de forma visível se o schema for corrigido — aí vira a hora
    // de fechar a lacuna.
    const response = await PATCH(patchRequest({ content: "   " }), params(COMMENT_ID));

    expect(response.status).toBe(200);
    expect(mockPrisma.comment.update.mock.calls[0][0].data).toEqual({ content: "   " });
  });
});

describe("DELETE /api/comments/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.comment.findUnique.mockResolvedValue({ id: COMMENT_ID, authorId: "test-user-id" });
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest(`http://localhost:3000/api/comments/${COMMENT_ID}`, { method: "DELETE" }),
      params(COMMENT_ID),
    );

    expect(response.status).toBe(401);
    expect(mockPrisma.comment.delete).not.toHaveBeenCalled();
  });

  it("deletes the comment of the session user", async () => {
    const response = await DELETE(
      new NextRequest(`http://localhost:3000/api/comments/${COMMENT_ID}`, { method: "DELETE" }),
      params(COMMENT_ID),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockPrisma.comment.delete).toHaveBeenCalledWith({ where: { id: COMMENT_ID } });
  });

  it("answers 404 for a comment that does not exist", async () => {
    mockPrisma.comment.findUnique.mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest(`http://localhost:3000/api/comments/${COMMENT_ID}`, { method: "DELETE" }),
      params(COMMENT_ID),
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.comment.delete).not.toHaveBeenCalled();
  });

  it("answers 403 and keeps the comment of someone else", async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ id: COMMENT_ID, authorId: OTHER });

    const response = await DELETE(
      new NextRequest(`http://localhost:3000/api/comments/${COMMENT_ID}`, { method: "DELETE" }),
      params(COMMENT_ID),
    );

    expect(response.status).toBe(403);
    expect(mockPrisma.comment.delete).not.toHaveBeenCalled();
  });
});

describe("POST /api/comments/[id]/like", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.comment.findUnique.mockResolvedValue({
      id: COMMENT_ID,
      author: { id: OTHER },
    });
    mockPrisma.block.findFirst.mockResolvedValue(null);
    mockPrisma.commentLike.create.mockResolvedValue({ id: "cl1" });
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await LIKE_POST(
      new Request(`http://localhost:3000/api/comments/${COMMENT_ID}/like`, { method: "POST" }),
      params(COMMENT_ID),
    );

    expect(response.status).toBe(401);
  });

  it("likes the comment and notifies its author", async () => {
    const response = await LIKE_POST(
      new Request(`http://localhost:3000/api/comments/${COMMENT_ID}/like`, { method: "POST" }),
      params(COMMENT_ID),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ liked: true });
    expect(mockPrisma.commentLike.create.mock.calls[0][0].data).toEqual({
      userId: "test-user-id",
      commentId: COMMENT_ID,
    });
    expect(mockPublish).toHaveBeenCalledWith({ userId: OTHER, type: "notification" });
  });

  it("does not notify the author when the user likes their own comment", async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ id: COMMENT_ID, author: { id: "test-user-id" } });

    await LIKE_POST(
      new Request(`http://localhost:3000/api/comments/${COMMENT_ID}/like`, { method: "POST" }),
      params(COMMENT_ID),
    );

    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("stays idempotent when the like already exists", async () => {
    const { Prisma } = await import("@prisma/client");
    mockPrisma.commentLike.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicada", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const response = await LIKE_POST(
      new Request(`http://localhost:3000/api/comments/${COMMENT_ID}/like`, { method: "POST" }),
      params(COMMENT_ID),
    );

    // A restrição única resolve a corrida entre dois cliques, mas o cliente
    // ainda precisa receber o estado final: curtido, sem erro.
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ liked: true });
  });

  it("answers 404 for a comment that does not exist", async () => {
    mockPrisma.comment.findUnique.mockResolvedValue(null);

    const response = await LIKE_POST(
      new Request(`http://localhost:3000/api/comments/${COMMENT_ID}/like`, { method: "POST" }),
      params(COMMENT_ID),
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.commentLike.create).not.toHaveBeenCalled();
  });

  it("answers 403 when the viewer is blocked by the comment author", async () => {
    mockPrisma.block.findFirst.mockResolvedValue({ id: "b1" });

    const response = await LIKE_POST(
      new Request(`http://localhost:3000/api/comments/${COMMENT_ID}/like`, { method: "POST" }),
      params(COMMENT_ID),
    );

    expect(response.status).toBe(403);
    expect(mockPrisma.commentLike.create).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/comments/[id]/like", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.commentLike.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await LIKE_DELETE(
      new Request(`http://localhost:3000/api/comments/${COMMENT_ID}/like`, { method: "DELETE" }),
      params(COMMENT_ID),
    );

    expect(response.status).toBe(401);
    expect(mockPrisma.commentLike.deleteMany).not.toHaveBeenCalled();
  });

  it("removes the like and reports how many rows went away", async () => {
    const response = await LIKE_DELETE(
      new Request(`http://localhost:3000/api/comments/${COMMENT_ID}/like`, { method: "DELETE" }),
      params(COMMENT_ID),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ liked: false, removed: 1 });
    expect(mockPrisma.commentLike.deleteMany.mock.calls[0][0].where).toEqual({
      userId: "test-user-id",
      commentId: COMMENT_ID,
    });
  });

  it("is idempotent when there was no like to remove", async () => {
    mockPrisma.commentLike.deleteMany.mockResolvedValue({ count: 0 });

    const response = await LIKE_DELETE(
      new Request(`http://localhost:3000/api/comments/${COMMENT_ID}/like`, { method: "DELETE" }),
      params(COMMENT_ID),
    );

    // Descurtir duas vezes não é erro: a segunda remove zero linhas e o cliente
    // recebe o estado final, consistente.
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ liked: false, removed: 0 });
  });
});

describe("GET /api/comments/[id]/replies", () => {
  const topLevel = { id: COMMENT_ID, parentId: null, post: { authorId: OTHER } };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.comment.findUnique.mockResolvedValue(topLevel);
    mockPrisma.block.findFirst.mockResolvedValue(null);
    mockPrisma.block.findMany.mockResolvedValue([]);
    mockPrisma.comment.findMany.mockResolvedValue([]);
  });

  const get = (query = "") =>
    REPLIES_GET(
      new NextRequest(`http://localhost:3000/api/comments/${COMMENT_ID}/replies${query}`),
      params(COMMENT_ID),
    );

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await get()).status).toBe(401);
  });

  it("returns the replies oldest first", async () => {
    await get();
    const query = mockPrisma.comment.findMany.mock.calls[0][0];

    expect(query.where).toEqual({ parentId: COMMENT_ID, authorId: { notIn: [] } });
    expect(query.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
  });

  it("hides replies written by users the viewer blocked", async () => {
    mockPrisma.block.findMany.mockImplementation(({ where }: { where: { userId?: string } }) =>
      Promise.resolve(where.userId ? [{ blockedUserId: "u9" }] : [{ userId: "u8" }]),
    );

    await get();

    expect(mockPrisma.comment.findMany.mock.calls[0][0].where.authorId).toEqual({
      notIn: ["u9", "u8"],
    });
  });

  it("marks which replies the viewer already liked", async () => {
    await get();
    const include = mockPrisma.comment.findMany.mock.calls[0][0].include;

    // `likes` filtrada pelo próprio usuário vira o booleano "já curtido" sem
    // uma segunda consulta: é o que evita N+1 na lista de respostas.
    expect(include.likes.where).toEqual({ userId: "test-user-id" });
    expect(include.likes.take).toBe(1);
  });

  it("answers 404 for a comment that does not exist", async () => {
    mockPrisma.comment.findUnique.mockResolvedValue(null);

    expect((await get()).status).toBe(404);
    expect(mockPrisma.comment.findMany).not.toHaveBeenCalled();
  });

  it("refuses to list replies of a reply, so the tree cannot grow deeper", async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ ...topLevel, parentId: "outro" });

    expect((await get()).status).toBe(400);
    expect(mockPrisma.comment.findMany).not.toHaveBeenCalled();
  });

  it("answers 403 when the viewer is blocked by the author of the post", async () => {
    mockPrisma.block.findFirst.mockResolvedValue({ id: "b1" });

    expect((await get()).status).toBe(403);
    expect(mockPrisma.comment.findMany).not.toHaveBeenCalled();
  });

  it("refuses a non-integer offset", async () => {
    expect((await get("?offset=abc")).status).toBe(400);
  });

  it("refuses a negative offset", async () => {
    expect((await get("?offset=-1")).status).toBe(400);
  });

  it("uses the offset to skip when no cursor is given", async () => {
    await get("?offset=20");

    const query = mockPrisma.comment.findMany.mock.calls[0][0];
    expect(query.skip).toBe(20);
    expect(query).not.toHaveProperty("cursor");
  });

  it("prefers the cursor over the offset, so paging does not skip rows", async () => {
    await get("?cursor=c5&offset=20");

    const query = mockPrisma.comment.findMany.mock.calls[0][0];
    // Com cursor, o skip é 1 para não repetir a linha do cursor. Somar o offset
    // aos dois deixaria buracos na lista quando um item fosse removido no meio.
    expect(query.skip).toBe(1);
    expect(query.cursor).toEqual({ id: "c5" });
  });
});
