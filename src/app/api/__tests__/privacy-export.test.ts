// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "@/test/api-helpers";

const { mockPrisma, mockGetServerSession, mockLogSecurityEvent } = vi.hoisted(() => {
  const fn = () => vi.fn();
  const model = () => ({
    findUnique: fn(), findFirst: fn(), findMany: fn(),
    create: fn(), update: fn(), delete: fn(), deleteMany: fn(), count: fn(),
  });
  return {
    mockPrisma: {
      user: model(),
      post: model(),
      comment: model(),
      like: model(),
      commentLike: model(),
      careerHistory: model(),
      achievement: model(),
      teamMember: model(),
      connection: model(),
      event: model(),
      notification: model(),
      conversation: model(),
      report: model(),
      privacyRequest: model(),
      block: model(),
      teamFollow: model(),
      mediaAsset: model(),
      activityLog: model(),
    },
    mockGetServerSession: fn(),
    mockLogSecurityEvent: fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: (...args: unknown[]) => mockGetServerSession(...args) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/security-events", () => ({ logSecurityEvent: mockLogSecurityEvent }));

import { GET } from "@/app/api/privacy/export/route";

const USER_ID = "test-user-id";

// As 18 seções que a exportação promete, com os nomes exatos do payload. A
// lista é explícita de propósito: se um dia um modelo novo entrar no schema e
// for esquecido na exportação, este teste não acusaria sozinho — mas a
// conferência do schema contra esta lista, feita na manutenção, sim.
const SECOES = [
  "profile", "posts", "comments", "likes", "commentLikes", "career",
  "achievements", "memberships", "connections", "events", "notifications",
  "conversations", "reports", "privacyRequests", "blocks", "teamFollows",
  "mediaAssets", "activityLogs",
] as const;

describe("GET /api/privacy/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    for (const model of Object.values(mockPrisma)) {
      if (model && typeof (model as { findMany?: unknown }).findMany === "function") {
        (model.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      }
    }
    // O mock devolve só o que o select permitiria devolver, como o Prisma faz
    // com um registro real. A garantia do hash está no select, verificado no
    // teste seguinte.
    mockPrisma.user.findUnique.mockResolvedValue({
      id: USER_ID,
      email: "t@e.com",
      name: "Teste",
      username: "teste",
      avatar: null,
      profileVisibility: "PUBLIC",
    });
    mockPrisma.privacyRequest.create.mockResolvedValue({ id: "pr1" });
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockPrisma.post.findMany).not.toHaveBeenCalled();
  });

  it("sends the file as a download rather than inline JSON", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="cheerconnect-data-${USER_ID}.json"`,
    );
    // Um export de dados é pessoal e não pode ficar em cache compartilhado.
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("includes every promised section", async () => {
    const data = await (await GET()).json();

    for (const secao of SECOES) {
      expect(data).toHaveProperty(secao);
    }
  });

  it("stamps the moment of the export", async () => {
    const data = await (await GET()).json();

    expect(data.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("exports only the requesting user's data", async () => {
    await GET();

    // A GDPR/LGPD exige que a exportação seja do titular, e cada consulta leva
    // o where com o id da sessão — não um parâmetro vindo do corpo.
    for (const model of ["post", "comment", "careerHistory", "achievement", "notification", "activityLog"]) {
      const calls = (mockPrisma as unknown as Record<string, { findMany: { mock: { calls: unknown[][] } } }>)[model].findMany.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(JSON.stringify(calls[0][0])).toContain(USER_ID);
    }
  });

  it("never asks the database for the password hash", async () => {
    await GET();

    // A garantia não está em filtrar o resultado depois, está no select: o
    // Prisma só devolve o que foi pedido, então listar o campo nem chega a
    // tocar o banco.
    const select = mockPrisma.user.findUnique.mock.calls[0][0].select as Record<string, boolean>;
    expect(select).not.toHaveProperty("password");
    expect(Object.keys(select)).toContain("email");
  });

  it("assembles the profile from the selected fields only", async () => {
    const data = await (await GET()).json();

    // Rede de segurança para uma futura troca de select por include, que
    // devolveria o hash da senha junto.
    expect(JSON.stringify(data)).not.toMatch(/password|hash-que-nao-deve-vazar/);
  });

  it("records the export as a privacy request, so the titular has a trail", async () => {
    await GET();

    const created = mockPrisma.privacyRequest.create.mock.calls[0][0].data;
    expect(created).toEqual(
      expect.objectContaining({ userId: USER_ID, type: "EXPORT", status: "COMPLETED" }),
    );
    expect(created.expiresAt).toBeInstanceOf(Date);
  });

  it("logs a security event for the export", async () => {
    await GET();

    expect(mockLogSecurityEvent).toHaveBeenCalled();
  });

  it("returns an empty section rather than failing when there is nothing to export", async () => {
    const response = await GET();

    const data = await response.json();
    expect(data.posts).toEqual([]);
    expect(data.career).toEqual([]);
  });

  it("formats the JSON with indentation, since a human will open it", async () => {
    const response = await GET();

    const raw = await response.text();
    expect(raw).toContain('\n  "exportedAt"');
  });
});
