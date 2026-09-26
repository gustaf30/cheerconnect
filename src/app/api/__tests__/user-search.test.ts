// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "@/test/api-helpers";

const { mockPrisma, mockGetServerSession, mockPublish } = vi.hoisted(() => {
  const fn = () => vi.fn();
  const model = () => ({
    findUnique: fn(), findFirst: fn(), findMany: fn(),
    create: fn(), update: fn(), delete: fn(), deleteMany: fn(), count: fn(),
  });
  return {
    mockPrisma: {
      post: model(),
      user: model(),
      connection: model(),
      notification: { create: fn() },
      tag: { findUnique: fn() },
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

import { GET as SEARCH_USERS } from "@/app/api/users/route";
import { GET as TAG_POSTS } from "@/app/api/tags/[name]/route";
import { GET as OPENAPI } from "@/app/api/docs/route";

const OTHER = "outro-usuario";

describe("GET /api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.connection.findMany.mockResolvedValue([]);
    mockPrisma.block.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
  });

  const search = (q: string) => SEARCH_USERS(new Request(`http://localhost/api/users?${q}`));

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await search("q=a")).status).toBe(401);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("never lists the viewer themself", async () => {
    await search("");

    expect(mockPrisma.user.findMany.mock.calls[0][0].where.id).toEqual({ not: "test-user-id" });
  });

  it("returns only public profiles or people already connected", async () => {
    await search("");

    const and = mockPrisma.user.findMany.mock.calls[0][0].where.AND;
    // Este é o filtro de privacidade da busca: perfil privado só aparece para
    // quem já tem conexão, e o resto nem chega a ser contado.
    expect(and[0]).toEqual({
      OR: [{ profileVisibility: "PUBLIC" }, { id: { in: [] } }],
    });
  });

  it("includes connected users in the visibility exception", async () => {
    mockPrisma.connection.findMany.mockResolvedValue([
      { senderId: "test-user-id", receiverId: OTHER },
    ]);

    await search("");

    const and = mockPrisma.user.findMany.mock.calls[0][0].where.AND;
    expect(and[0].OR[1]).toEqual({ id: { in: [OTHER] } });
  });

  it("excludes blocked users, in both directions", async () => {
    mockPrisma.block.findMany.mockImplementation(({ where }: { where: { userId?: string } }) =>
      Promise.resolve(where.userId ? [{ blockedUserId: "u9" }] : [{ userId: "u8" }]),
    );

    await search("");

    const and = mockPrisma.user.findMany.mock.calls[0][0].where.AND;
    expect(and[0].id).toEqual({ notIn: ["u9", "u8"] });
  });

  it("omits the block filter entirely when nobody is blocked", async () => {
    await search("");

    // Um notIn vazio no meio do AND mudaria a semântica da consulta; a rota
    // prefere não incluir o termo.
    const and = mockPrisma.user.findMany.mock.calls[0][0].where.AND;
    expect(and[0]).not.toHaveProperty("id");
  });

  it("searches by name and username, ignoring case", async () => {
    await search("q=ana");

    const and = mockPrisma.user.findMany.mock.calls[0][0].where.AND;
    expect(and[1].OR).toEqual([
      { name: { contains: "ana", mode: "insensitive" } },
      { username: { contains: "ana", mode: "insensitive" } },
    ]);
  });

  it("filters by a valid position", async () => {
    await search("position=FLYER");

    const and = mockPrisma.user.findMany.mock.calls[0][0].where.AND;
    expect(and[2]).toEqual({ positions: { has: "FLYER" } });
  });

  it("refuses a position outside the cheerleading enum", async () => {
    const response = await search("position=GOLFEIRO");

    // Sem esta checagem o valor chegaria ao Postgres como um enum inexistente.
    expect(response.status).toBe(400);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("returns only the public fields, never the email", async () => {
    await search("");

    const select = mockPrisma.user.findMany.mock.calls[0][0].select;
    expect(Object.keys(select).sort()).toEqual(
      ["avatar", "bio", "experience", "id", "location", "name", "positions", "username"].sort(),
    );
    expect(select).not.toHaveProperty("email");
  });

  it("marks the response private, since results depend on who is asking", async () => {
    const response = await search("");

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("reads one extra row to know whether there is a next page", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }, { id: "u3" }]);

    const data = await (await search("limit=2")).json();

    expect(mockPrisma.user.findMany.mock.calls[0][0].take).toBe(3);
    expect(data.users).toHaveLength(2);
    expect(data.nextCursor).toBe("u2");
  });

  it("offers no next cursor on the last page", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "u1" }]);

    expect((await (await search("")).json()).nextCursor).toBeNull();
  });
});

describe("GET /api/users?mode=suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.connection.findMany.mockResolvedValue([]);
    mockPrisma.block.findMany.mockResolvedValue([]);
    mockPrisma.user.findUnique.mockResolvedValue({ positions: ["FLYER"], location: "Curitiba, PR" });
    mockPrisma.user.findMany.mockResolvedValue([]);
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await SEARCH_USERS(new Request("http://localhost/api/users?mode=suggestions"))).status).toBe(401);
  });

  it("excludes the viewer, their connections and their blocks from every source", async () => {
    mockPrisma.connection.findMany.mockResolvedValue([
      { senderId: "test-user-id", receiverId: "conectado" },
    ]);
    mockPrisma.block.findMany.mockImplementation(({ where }: { where: { userId?: string } }) =>
      Promise.resolve(where.userId ? [{ blockedUserId: "u9" }] : []),
    );

    await SEARCH_USERS(new Request("http://localhost/api/users?mode=suggestions"));

    const naoMostra = ["test-user-id", "conectado", "u9"];
    // Quatro fontes de sugestão, duas formas de excluir: as três por posição,
    // região e fallback filtram com notIn; a de amizade de segundo grau busca
    // com in os ids que ela mesma derivou, e por isso a exclusão é feita antes.
    for (const call of mockPrisma.user.findMany.mock.calls) {
      const where = call[0].where;
      if (where.id?.notIn) {
        expect(where.id.notIn).toEqual(expect.arrayContaining(naoMostra));
      } else {
        expect(where.id?.in ?? []).not.toEqual(expect.arrayContaining(naoMostra));
      }
      expect(where.profileVisibility).toBe("PUBLIC");
    }
  });

  it("never suggests a private profile", async () => {
    await SEARCH_USERS(new Request("http://localhost/api/users?mode=suggestions"));

    for (const call of mockPrisma.user.findMany.mock.calls) {
      expect(call[0].where.profileVisibility).toBe("PUBLIC");
    }
  });

  it("returns each person once even when several sources overlap", async () => {
    const sameUser = { id: "u1", name: "Repetida" };
    mockPrisma.connection.findMany.mockResolvedValue([
      { senderId: "test-user-id", receiverId: "amigo" },
      { senderId: "amigo", receiverId: "u1" },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([sameUser, sameUser, sameUser]);

    const data = await (
      await SEARCH_USERS(new Request("http://localhost/api/users?mode=suggestions"))
    ).json();

    // Amizade de segundo grau, mesma posição e mesma região podem devolver a
    // mesma pessoa; sem o filtro por id, a lista repetiria o mesmo cartão.
    expect(data.users).toHaveLength(1);
  });

  it("does not page suggestions, since all sources are bounded", async () => {
    const data = await (
      await SEARCH_USERS(new Request("http://localhost/api/users?mode=suggestions"))
    ).json();

    expect(data.nextCursor).toBeNull();
  });
});

describe("GET /api/tags/[name]", () => {
  // A rota monta cada linha com likes/reposts e derived isLiked/hasReposted, e
  // também resolve o post original de um repost. O mock precisa ter essa forma
  // ou a formatação quebra antes da resposta.
  const postRow = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    content: `post ${id}`,
    createdAt: new Date("2026-09-20T12:00:00.000Z"),
    author: { id: OTHER, username: "autor", name: "Autor" },
    likes: [],
    reposts: [],
    originalPost: null,
    _count: { likes: 0, comments: 0, reposts: 0 },
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.block.findMany.mockResolvedValue([]);
    mockPrisma.tag.findUnique.mockResolvedValue({ id: "tag1", name: "copa" });
    mockPrisma.post.findMany.mockResolvedValue([]);
  });

  const tag = (name: string, q = "") => TAG_POSTS(
    new Request(`http://localhost/api/tags/${name}?${q}`),
    { params: Promise.resolve({ name }) },
  );

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await tag("copa")).status).toBe(401);
  });

  it("returns an empty page for a tag nobody used, instead of a 404", async () => {
    mockPrisma.tag.findUnique.mockResolvedValue(null);

    const response = await tag("inexistente");

    // A diferença importa para o front-end: tag vazia é um resultado, não um erro.
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ posts: [], nextCursor: null });
    expect(mockPrisma.post.findMany).not.toHaveBeenCalled();
  });

  it("lower-cases the tag, so #Copa and #copa are the same page", async () => {
    await tag("Copa");

    expect(mockPrisma.tag.findUnique.mock.calls[0][0].where).toEqual({ name: "copa" });
  });

  it("refuses a malformed percent-encoding instead of crashing", async () => {
    const response = await tag("%E0%A4%A");

    // Um nome malformado viraria exceção não tratada e derrubaria a requisição.
    expect(response.status).toBe(400);
  });

  it("lists the tag posts newest first", async () => {
    await tag("copa");

    expect(mockPrisma.post.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: "desc" });
  });

  it("reads one extra row to know whether there is a next page", async () => {
    mockPrisma.post.findMany.mockResolvedValue([postRow("p1"), postRow("p2"), postRow("p3")]);

    const data = await (await tag("copa", "limit=2")).json();

    expect(mockPrisma.post.findMany.mock.calls[0][0].take).toBe(3);
    expect(data.posts).toHaveLength(2);
    expect(data.nextCursor).toBe("p2");
  });

  it("derives isLiked and hasReposted for each post", async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      postRow("p1", { likes: [{ id: "l1" }], reposts: [{ id: "r1" }] }),
    ]);

    const data = await (await tag("copa")).json();

    expect(data.posts[0].isLiked).toBe(true);
    expect(data.posts[0].hasReposted).toBe(true);
  });

  it("hides a repost whose original author is blocked, without hiding the repost itself", async () => {
    mockPrisma.block.findMany.mockImplementation(({ where }: { where: { userId?: string } }) =>
      Promise.resolve(where.userId ? [{ blockedUserId: OTHER }] : []),
    );
    mockPrisma.post.findMany.mockResolvedValue([
      postRow("p1", {
        originalPost: postRow("orig", { author: { id: OTHER, username: "x", name: "X" } }),
      }),
    ]);

    const data = await (await tag("copa")).json();

    // O repost continua visível; o que some é o conteúdo original de quem está
    // bloqueado, para o bloqueio valer mesmo através de uma indireção.
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].originalPost).toBeNull();
  });

  it("marks the response private", async () => {
    const response = await tag("copa");

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

describe("GET /api/docs", () => {
  it("serves the OpenAPI document as JSON", async () => {
    const response = await OPENAPI();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const spec = await response.json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
  });

  it("documents the same routes the API exposes", async () => {
    const spec = await (await OPENAPI()).json();

    // Um documento desatualizado é pior que nenhum: o cliente passaria a chamar
    // rota que não existe.
    expect(Object.keys(spec.paths)).toContain("/api/posts");
    expect(Object.keys(spec.paths)).toContain("/api/teams");
  });
});
