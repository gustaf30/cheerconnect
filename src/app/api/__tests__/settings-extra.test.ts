// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "@/test/api-helpers";

const { mockPrisma, mockGetServerSession, mockCompare, mockHash, mockLogSecurityEvent } = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    mockPrisma: {
      user: { findUnique: fn(), findMany: fn(), update: fn() },
      team: { findMany: fn() },
      message: { count: fn() },
      block: { findFirst: fn(), findMany: fn() },
    },
    mockGetServerSession: fn(),
    mockCompare: fn(),
    mockHash: fn(),
    mockLogSecurityEvent: fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: (...args: unknown[]) => mockGetServerSession(...args) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("bcryptjs", () => ({ default: { compare: mockCompare, hash: mockHash } }));
vi.mock("@/lib/security-events", () => ({ logSecurityEvent: mockLogSecurityEvent }));

import { POST as CHANGE_PASSWORD } from "@/app/api/settings/password/route";
import { GET as USERNAME_AVAILABILITY } from "@/app/api/settings/username/route";
import { GET as MY_TEAMS } from "@/app/api/users/me/teams/route";
import { GET as UNREAD_COUNT } from "@/app/api/messages/count/route";

const STRONG = "Senha-Forte-1";

function passwordRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/settings/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/settings/password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.user.findUnique.mockResolvedValue({ id: "test-user-id", password: "hash-atual" });
    mockCompare.mockResolvedValue(true);
    mockHash.mockResolvedValue("hash-novo");
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await CHANGE_PASSWORD(
      passwordRequest({ currentPassword: "antiga", newPassword: STRONG, confirmPassword: STRONG }),
    );

    expect(response.status).toBe(401);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("changes the password and bumps the token version", async () => {
    const response = await CHANGE_PASSWORD(
      passwordRequest({ currentPassword: "antiga", newPassword: STRONG, confirmPassword: STRONG }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    // Incrementar tokenVersion é o que desloga as demais sessões: sem isso, uma
    // senha vazada continuaria válida nos outros dispositivos.
    expect(mockPrisma.user.update.mock.calls[0][0].data).toEqual({
      password: "hash-novo",
      tokenVersion: { increment: 1 },
    });
  });

  it("hashes the new password with cost 12 before storing it", async () => {
    await CHANGE_PASSWORD(
      passwordRequest({ currentPassword: "antiga", newPassword: STRONG, confirmPassword: STRONG }),
    );

    expect(mockHash).toHaveBeenCalledWith(STRONG, 12);
    expect(mockPrisma.user.update.mock.calls[0][0].data.password).toBe("hash-novo");
  });

  it("records a security event", async () => {
    await CHANGE_PASSWORD(
      passwordRequest({ currentPassword: "antiga", newPassword: STRONG, confirmPassword: STRONG }),
    );

    expect(mockLogSecurityEvent).toHaveBeenCalledWith("auth.password_changed", {
      userId: "test-user-id",
    });
  });

  it("refuses a wrong current password without touching the stored one", async () => {
    mockCompare.mockResolvedValue(false);

    const response = await CHANGE_PASSWORD(
      passwordRequest({ currentPassword: "errada", newPassword: STRONG, confirmPassword: STRONG }),
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockLogSecurityEvent).not.toHaveBeenCalled();
  });

  it("explains that an OAuth-only account has no password to change", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "test-user-id", password: null });

    const response = await CHANGE_PASSWORD(
      passwordRequest({ currentPassword: "antiga", newPassword: STRONG, confirmPassword: STRONG }),
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("answers 404 when the session user is gone", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    expect(
      (
        await CHANGE_PASSWORD(
          passwordRequest({ currentPassword: "antiga", newPassword: STRONG, confirmPassword: STRONG }),
        )
      ).status,
    ).toBe(404);
  });

  it("refuses a new password shorter than the minimum", async () => {
    const response = await CHANGE_PASSWORD(
      passwordRequest({ currentPassword: "antiga", newPassword: "Ab1", confirmPassword: "Ab1" }),
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("refuses a new password without a digit", async () => {
    const response = await CHANGE_PASSWORD(
      passwordRequest({
        currentPassword: "antiga",
        newPassword: "senhasemdigito",
        confirmPassword: "senhasemdigito",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("refuses when the confirmation does not match", async () => {
    const response = await CHANGE_PASSWORD(
      passwordRequest({ currentPassword: "antiga", newPassword: STRONG, confirmPassword: "Outra-1" }),
    );

    expect(response.status).toBe(400);
    expect(mockCompare).not.toHaveBeenCalled();
  });
});

describe("GET /api/settings/username", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.user.findUnique.mockResolvedValue(null);
  });

  const get = (q: string) => USERNAME_AVAILABILITY(new Request(`http://localhost/api/settings/username?username=${q}`));

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await get("novo")).status).toBe(401);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("reports an unused username as available", async () => {
    const response = await get("novousuario");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ available: true });
  });

  it("reports a taken username as unavailable", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "outro" });

    expect(await (await get("ocupado")).json()).toEqual({ available: false });
  });

  it("keeps the viewer's own username available, so editing a profile is not blocked", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "test-user-id" });

    expect(await (await get("meunome")).json()).toEqual({ available: true });
  });

  it("rejects a username shorter than three characters", async () => {
    const response = await get("ab");

    expect(await response.json()).toEqual({
      available: false,
      error: "Username deve ter pelo menos 3 caracteres",
    });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a username with punctuation, without hitting the database", async () => {
    const response = await get("nome-invalido");

    expect(await response.json()).toEqual({
      available: false,
      error: "Username pode conter apenas letras, números e _",
    });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("treats a missing parameter as invalid", async () => {
    const response = await USERNAME_AVAILABILITY(new Request("http://localhost/api/settings/username"));

    expect((await response.json()).available).toBe(false);
  });
});

describe("GET /api/users/me/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findMany.mockResolvedValue([]);
  });

  const get = (q = "") => MY_TEAMS(new Request(`http://localhost/api/users/me/teams${q}`));

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await get()).status).toBe(401);
    expect(mockPrisma.team.findMany).not.toHaveBeenCalled();
  });

  it("lists only teams the viewer is an active member of", async () => {
    await get();

    const where = mockPrisma.team.findMany.mock.calls[0][0].where;
    // isActive importa: sair de uma equipe não pode deixar a equipe na lista.
    expect(where.members).toEqual({ some: { userId: "test-user-id", isActive: true } });
  });

  it("searches by name or location, ignoring case", async () => {
    await get("?q=Squad");

    const and = mockPrisma.team.findMany.mock.calls[0][0].where.AND;
    expect(and[0].OR).toEqual([
      { name: { contains: "Squad", mode: "insensitive" } },
      { location: { contains: "Squad", mode: "insensitive" } },
    ]);
  });

  it("filters by category only when one is given", async () => {
    await get("?category=ALLSTAR");

    const and = mockPrisma.team.findMany.mock.calls[0][0].where.AND;
    expect(and[1]).toEqual({ category: "ALLSTAR" });
  });

  it("ignores a blank category instead of filtering for an empty value", async () => {
    await get("?category=%20%20");

    const and = mockPrisma.team.findMany.mock.calls[0][0].where.AND;
    expect(and[1]).toEqual({});
  });

  it("reads one extra row to know whether there is a next page", async () => {
    mockPrisma.team.findMany.mockResolvedValue([{ id: "t1" }, { id: "t2" }, { id: "t3" }]);

    const data = await (await get("?limit=2")).json();

    expect(mockPrisma.team.findMany.mock.calls[0][0].take).toBe(3);
    expect(data.teams).toHaveLength(2);
    expect(data.nextCursor).toBe("t2");
  });

  it("has no next cursor on the last page", async () => {
    mockPrisma.team.findMany.mockResolvedValue([{ id: "t1" }]);

    expect((await (await get()).json()).nextCursor).toBeNull();
  });

  it("counts only active members, not the whole roster", async () => {
    await get();

    const select = mockPrisma.team.findMany.mock.calls[0][0].select;
    expect(select._count.select.members).toEqual({ where: { isActive: true } });
  });
});

describe("GET /api/messages/count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.block.findMany.mockResolvedValue([]);
    mockPrisma.message.count.mockResolvedValue(4);
  });

  const get = () => UNREAD_COUNT();

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await get()).status).toBe(401);
    expect(mockPrisma.message.count).not.toHaveBeenCalled();
  });

  it("returns the unread count and marks the response private", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 4 });
    // Contagem de não lidas é por pessoa: servir do cache compartilhado
    // mostraria o número de outra pessoa.
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("never counts what the viewer themself sent, nor what blocked users sent", async () => {
    mockPrisma.block.findMany.mockImplementation(({ where }: { where: { userId?: string } }) =>
      Promise.resolve(where.userId ? [{ blockedUserId: "u9" }] : [{ userId: "u8" }]),
    );

    await get();

    const where = mockPrisma.message.count.mock.calls[0][0].where;
    expect(where.isRead).toBe(false);
    expect(where.senderId).toEqual({ notIn: ["test-user-id", "u9", "u8"] });
  });

  it("restricts the count to conversations the viewer takes part in", async () => {
    await get();

    const where = mockPrisma.message.count.mock.calls[0][0].where;
    expect(where.conversation.OR).toEqual([
      { participant1Id: "test-user-id" },
      { participant2Id: "test-user-id" },
    ]);
  });
});
