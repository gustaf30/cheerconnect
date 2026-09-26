// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "@/test/api-helpers";
import { Prisma } from "@prisma/client";

const { mockPrisma, mockGetServerSession, mockPublish, mockSetNotifyReposted, mockReadState } = vi.hoisted(() => {
  const fn = () => vi.fn();
  // A preferência de notificar repost fica num estado separado, ajustável por
  // teste, e o mock de user.findUnique responde a ela.
  const state = { notifyPostReposted: true };
  return {
    mockPrisma: {
      post: { findUnique: fn(), create: fn(), deleteMany: fn() },
      user: { findUnique: fn() },
      notification: { create: fn() },
      block: { findFirst: fn(), findMany: fn() },
      $transaction: fn(),
    },
    mockGetServerSession: fn(),
    mockPublish: fn(),
    mockSetNotifyReposted: (value: boolean) => {
      state.notifyPostReposted = value;
    },
    // O mock é instalado no beforeEach e lê o estado no momento da chamada, de
    // modo que o teste ajusta a preferência sem reordenar a sequência de
    // mockResolvedValueOnce — que vaza entre testes porque clearAllMocks não
    // esvazia a fila.
    mockReadState: () => state.notifyPostReposted,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: (...args: unknown[]) => mockGetServerSession(...args) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/realtime-bus", () => ({ publishRealtimeEvent: mockPublish }));

import { POST, DELETE } from "@/app/api/posts/[id]/repost/route";

const POST_ID = "p1";
const OTHER = "outro-usuario";
const params = { params: Promise.resolve({ id: POST_ID }) };

const original = { id: POST_ID, authorId: OTHER, content: "Foto do ensaio", originalPostId: null };

function repostRequest(comment?: string) {
  return new Request(`http://localhost/api/posts/${POST_ID}/repost`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(comment === undefined ? {} : { content: comment }),
  });
}

describe("POST /api/posts/[id]/repost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    // O repost cria a linha dentro de uma transação. O callback precisa rodar de
    // verdade, com o mesmo mock de post.create, senão a rota recebe undefined e
    // cai no internalError — o resto do arquivo viraria teste de código morto.
    mockPrisma.$transaction.mockImplementation((callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
      callback(mockPrisma),
    );
    mockPrisma.post.findUnique.mockResolvedValue(original);
    mockPrisma.block.findFirst.mockResolvedValue(null);
    mockPrisma.block.findMany.mockResolvedValue([]);
    // Responder pelo select pedido em vez de enfileirar valores: a rota chama
    // findUnique para o repostador e para as preferências do autor, e uma fila
    // de mockResolvedValueOnce depende da ordem — que quebra se um teste
    // anterior deixar valor pendente, já que clearAllMocks não a esvazia.
    mockPrisma.user.findUnique.mockImplementation(({ select }: { select?: Record<string, boolean> }) => {
      if (select?.notifyPostReposted !== undefined) {
        return Promise.resolve({ notifyPostReposted: mockReadState() });
      }
      if (select?.profileVisibility !== undefined) {
        return Promise.resolve({ id: OTHER, profileVisibility: "PUBLIC" });
      }
      if (select?.tokenVersion !== undefined) {
        return Promise.resolve({ tokenVersion: undefined, emailVerified: true });
      }
      return Promise.resolve({ id: "test-user-id", name: "Reposter", username: "reposter" });
    });
    mockSetNotifyReposted(true);
    mockPrisma.notification.create.mockResolvedValue({ id: "n1" });
  });

  const post = (comment?: string) => POST(repostRequest(comment), params);

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await post()).status).toBe(401);
    expect(mockPrisma.post.create).not.toHaveBeenCalled();
  });

  it("returns 404 for a post that does not exist", async () => {
    mockPrisma.post.findUnique.mockResolvedValue(null);

    expect((await post()).status).toBe(404);
    expect(mockPrisma.post.create).not.toHaveBeenCalled();
  });

  it("returns 403 when the viewer is blocked by the author", async () => {
    mockPrisma.block.findFirst.mockResolvedValue({ id: "b1" });

    expect((await post()).status).toBe(403);
    expect(mockPrisma.post.create).not.toHaveBeenCalled();
  });

  it("refuses to repost one's own post", async () => {
    mockPrisma.post.findUnique.mockResolvedValue({ ...original, authorId: "test-user-id" });

    // Repostar a si mesmo não tem sentido: a notificação iria para o próprio
    // autor e a timeline mostraria o mesmo conteúdo duas vezes.
    expect((await post()).status).toBe(400);
    expect(mockPrisma.post.create).not.toHaveBeenCalled();
  });

  it("refuses to repost a repost, which would flatten the original", async () => {
    mockPrisma.post.findUnique.mockResolvedValue({ ...original, originalPostId: "origem" });

    expect((await post()).status).toBe(400);
    expect(mockPrisma.post.create).not.toHaveBeenCalled();
  });

  it("documents that a whitespace-only comment is accepted on a repost", async () => {
    // Lacuna conhecida, a mesma do PATCH de comentário: o schema usa apenas
    // .max(5000), sem .trim() antes de um .min(), então um comentário só com
    // espaços é gravado. O teste fixa o comportamento atual e avisa se mudar.
    mockPrisma.post.create.mockResolvedValue({
      id: "r1",
      content: "",
      createdAt: new Date(),
      originalPost: { ...original, createdAt: new Date() },
    });

    const response = await post("    ");

    expect(response.status).toBe(200);
    expect(mockPrisma.post.create.mock.calls[0][0].data.content).toBe("    ");
  });

  it("rejects a second repost of the same post, from the author of the duplicate", async () => {
    mockPrisma.post.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("repetido", { code: "P2002", clientVersion: "test" }),
    );

    // A restrição única (authorId, originalPostId) é a rede de proteção contra
    // o duplo clique criar duas linhas.
    expect((await post()).status).toBe(400);
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  it("keeps the comment optional", async () => {
    mockPrisma.post.create.mockResolvedValue({
      id: "r1",
      content: "",
      createdAt: new Date("2026-09-26T12:00:00.000Z"),
      originalPost: { ...original, createdAt: new Date("2026-09-20T12:00:00.000Z") },
    });

    const response = await post();

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.post.id).toBe("r1");
    expect(data.post.originalPost.id).toBe(POST_ID);
  });

  it("links the repost to the original, preserving when the original was published", async () => {
    mockPrisma.post.create.mockResolvedValue({
      id: "r1",
      content: "concordo",
      createdAt: new Date("2026-09-26T12:00:00.000Z"),
      originalPost: { ...original, createdAt: new Date("2026-09-20T12:00:00.000Z") },
    });

    const response = await post("concordo");
    const data = await response.json();

    expect(mockPrisma.post.create.mock.calls[0][0].data.originalPostId).toBe(POST_ID);
    // A data exibida é a do original, senão o repost pareceria conteúdo novo.
    expect(data.post.originalPost.createdAt).toBe("2026-09-20T12:00:00.000Z");
  });

  it("notifies the author of the original", async () => {
    mockPrisma.post.create.mockResolvedValue({
      id: "r1",
      content: "",
      createdAt: new Date(),
      originalPost: { ...original, createdAt: new Date() },
    });

    await post();

    expect(mockPrisma.notification.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ userId: OTHER, type: "POST_REPOSTED", relatedId: POST_ID }),
    );
    expect(mockPublish).toHaveBeenCalledWith({ userId: OTHER, type: "notification" });
  });

  it("says nothing when the author opted out of repost notifications", async () => {
    mockSetNotifyReposted(false);
    mockPrisma.post.create.mockResolvedValue({
      id: "r1",
      content: "",
      createdAt: new Date(),
      originalPost: { ...original, createdAt: new Date() },
    });

    const response = await post();

    expect(response.status).toBe(200);
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/posts/[id]/repost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.post.deleteMany.mockResolvedValue({ count: 1 });
  });

  const del = () =>
    DELETE(
      new Request(`http://localhost/api/posts/${POST_ID}/repost`, { method: "DELETE" }),
      params,
    );

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await del()).status).toBe(401);
    expect(mockPrisma.post.deleteMany).not.toHaveBeenCalled();
  });

  it("removes the repost and answers 404 when there was none", async () => {
    mockPrisma.post.deleteMany.mockResolvedValue({ count: 0 });

    const response = await del();

    // deleteMany em vez de delete: cancelar um repost duas vezes não pode
    // estourar erro de registro inexistente.
    expect(response.status).toBe(404);
  });

  it("deletes only the viewer's own repost of that post", async () => {
    const response = await del();

    expect(response.status).toBe(200);
    expect(mockPrisma.post.deleteMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ originalPostId: POST_ID, authorId: "test-user-id" }),
    );
  });
});
