// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "@/test/api-helpers";

const { mockPrisma, mockGetServerSession, mockPublish } = vi.hoisted(() => {
  const fn = () => vi.fn();
  const model = () => ({
    findUnique: fn(), findFirst: fn(), findMany: fn(),
    create: fn(), update: fn(), updateMany: fn(), delete: fn(), deleteMany: fn(), count: fn(),
  });
  return {
    mockPrisma: {
      team: model(),
      teamMember: model(),
      teamFollow: { findUnique: fn(), create: fn(), deleteMany: fn() },
      teamInvite: model(),
      post: { create: fn() },
      user: { findMany: fn() },
      tag: { upsert: fn() },
      postTag: { create: fn() },
      mention: { create: fn() },
      notification: { create: fn() },
      block: { findFirst: fn(), findMany: fn() },
      $transaction: fn(),
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

import {
  GET as FOLLOW_GET,
  POST as FOLLOW_POST,
  DELETE as FOLLOW_DELETE,
} from "@/app/api/teams/[slug]/follow/route";
import { GET as MEMBERS_GET } from "@/app/api/teams/[slug]/members/route";
import { DELETE as INVITE_REVOKE } from "@/app/api/teams/[slug]/invites/[id]/route";
import { POST as TEAM_POST } from "@/app/api/teams/[slug]/posts/route";
import { POST as INVITE_REJECT } from "@/app/api/teams/invites/[id]/reject/route";

const SLUG = "cheer-squad";
const TEAM_ID = "t1";
const OTHER = "outro-usuario";
const slugParams = { params: Promise.resolve({ slug: SLUG }) };
const slugIdParams = (id: string) => ({ params: Promise.resolve({ slug: SLUG, id }) });

const canPost = { role: "ATHLETE", canEdit: false, canPost: true, canInvite: false, canManageMembers: false, canDeleteTeam: false };
const canManage = { role: "COACH", canEdit: true, canPost: true, canInvite: true, canManageMembers: true, canDeleteTeam: false };
const noRights = { role: "ATHLETE", canEdit: false, canPost: false, canInvite: false, canManageMembers: false, canDeleteTeam: false };

describe("GET /api/teams/[slug]/follow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID });
    mockPrisma.teamFollow.findUnique.mockResolvedValue(null);
  });

  const get = () => FOLLOW_GET(new Request(`http://localhost/api/teams/${SLUG}/follow`), slugParams);

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await get()).status).toBe(401);
  });

  it("reports that the viewer does not follow the team", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ isFollowing: false });
  });

  it("reports that the viewer follows the team", async () => {
    mockPrisma.teamFollow.findUnique.mockResolvedValue({ userId: "test-user-id", teamId: TEAM_ID });

    expect(await (await get()).json()).toEqual({ isFollowing: true });
  });

  it("answers 404 for an unknown slug", async () => {
    mockPrisma.team.findUnique.mockResolvedValue(null);

    expect((await get()).status).toBe(404);
  });
});

describe("POST /api/teams/[slug]/follow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID });
    mockPrisma.teamFollow.findUnique.mockResolvedValue(null);
    mockPrisma.teamFollow.create.mockResolvedValue({ userId: "test-user-id", teamId: TEAM_ID });
  });

  const post = () => FOLLOW_POST(new Request(`http://localhost/api/teams/${SLUG}/follow`, { method: "POST" }), slugParams);

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await post()).status).toBe(401);
    expect(mockPrisma.teamFollow.create).not.toHaveBeenCalled();
  });

  it("follows the team", async () => {
    const response = await post();

    expect(response.status).toBe(200);
    expect(mockPrisma.teamFollow.create.mock.calls[0][0].data).toEqual({
      userId: "test-user-id",
      teamId: TEAM_ID,
    });
  });

  it("refuses to follow twice, so no duplicate row is created", async () => {
    mockPrisma.teamFollow.findUnique.mockResolvedValue({ userId: "test-user-id", teamId: TEAM_ID });

    expect((await post()).status).toBe(400);
    expect(mockPrisma.teamFollow.create).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown slug", async () => {
    mockPrisma.team.findUnique.mockResolvedValue(null);

    expect((await post()).status).toBe(404);
  });
});

describe("DELETE /api/teams/[slug]/follow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID });
    mockPrisma.teamFollow.deleteMany.mockResolvedValue({ count: 1 });
  });

  const del = () => FOLLOW_DELETE(new Request(`http://localhost/api/teams/${SLUG}/follow`, { method: "DELETE" }), slugParams);

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await del()).status).toBe(401);
  });

  it("unfollows by deleting the pair, and is idempotent", async () => {
    mockPrisma.teamFollow.deleteMany.mockResolvedValue({ count: 0 });

    const response = await del();

    // Deixar de seguir duas vezes não é erro; a segunda remove zero linhas.
    expect(response.status).toBe(200);
    expect(mockPrisma.teamFollow.deleteMany.mock.calls[0][0].where).toEqual({
      userId: "test-user-id",
      teamId: TEAM_ID,
    });
  });

  it("answers 404 for an unknown slug", async () => {
    mockPrisma.team.findUnique.mockResolvedValue(null);

    expect((await del()).status).toBe(404);
  });
});

describe("GET /api/teams/[slug]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, name: "Squad" });
    mockPrisma.teamMember.findFirst.mockResolvedValue(null);
    mockPrisma.teamMember.findMany.mockResolvedValue([]);
    mockPrisma.block.findMany.mockResolvedValue([]);
  });

  const get = (query = "") =>
    MEMBERS_GET(new Request(`http://localhost/api/teams/${SLUG}/members${query}`), slugParams);

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await get()).status).toBe(401);
  });

  it("lists members of an unknown slug as 404", async () => {
    mockPrisma.team.findUnique.mockResolvedValue(null);

    expect((await get()).status).toBe(404);
    expect(mockPrisma.teamMember.findMany).not.toHaveBeenCalled();
  });

  it("hides members the viewer blocked, without dropping the viewer themself", async () => {
    mockPrisma.block.findMany.mockImplementation(({ where }: { where: { userId?: string } }) =>
      Promise.resolve(where.userId ? [{ blockedUserId: OTHER }] : []),
    );

    await get();

    expect(mockPrisma.teamMember.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ teamId: TEAM_ID, userId: { notIn: [OTHER] } }),
    );
  });

  it("tells the client whether the viewer may manage the roster", async () => {
    mockPrisma.teamMember.findFirst.mockResolvedValue({ id: "tm1", role: "COACH", canManageMembers: true });

    const data = await (await get()).json();

    // O front-end usa isto para decidir se mostra editar/remover: sem vir do
    // servidor, o botão apareceria para quem não pode agir.
    expect(data.permissions.canManageMembers).toBe(true);
  });

  it("reports no permissions when the viewer is not a member", async () => {
    mockPrisma.teamMember.findFirst.mockResolvedValue(null);

    const data = await (await get()).json();

    expect(data.permissions.canManageMembers).toBe(false);
    expect(data.permissions.canEdit).toBe(false);
  });

  it("caps the page at 100 members", async () => {
    await get("?limit=5000");

    expect(mockPrisma.teamMember.findMany.mock.calls[0][0].take).toBeLessThanOrEqual(101);
  });
});

describe("DELETE /api/teams/[slug]/invites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, members: [canManage] });
    mockPrisma.teamInvite.deleteMany.mockResolvedValue({ count: 1 });
  });

  const del = (id = "inv1") =>
    INVITE_REVOKE(
      new Request(`http://localhost/api/teams/${SLUG}/invites/${id}`, { method: "DELETE" }),
      slugIdParams(id),
    );

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await del()).status).toBe(401);
    expect(mockPrisma.teamInvite.deleteMany).not.toHaveBeenCalled();
  });

  it("lets a manager cancel the invite", async () => {
    const response = await del();

    expect(response.status).toBe(200);
    expect(mockPrisma.teamInvite.deleteMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ id: "inv1", teamId: TEAM_ID }),
    );
  });

  it("answers 404 for an unknown slug", async () => {
    mockPrisma.team.findUnique.mockResolvedValue(null);

    expect((await del()).status).toBe(404);
  });

  it("answers 403 for a member who cannot manage the roster, and keeps the invite", async () => {
    // O filtro canManageMembers está dentro da query do Prisma, então um membro
    // sem a permissão volta com members vazio: a equipe existe, a pessoa não
    // pode gerenciar a lista. É esse vazio que a rota traduz em 403.
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, members: [] });

    expect((await del()).status).toBe(403);
    expect(mockPrisma.teamInvite.deleteMany).not.toHaveBeenCalled();
  });

  it("answers 403 for a non-member", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, members: [] });

    expect((await del()).status).toBe(403);
  });

  it("answers 404 when the invite was already gone", async () => {
    mockPrisma.teamInvite.deleteMany.mockResolvedValue({ count: 0 });

    expect((await del()).status).toBe(404);
  });
});

describe("POST /api/teams/invites/[id]/reject", () => {
  const pending = { id: "inv1", userId: "test-user-id", status: "PENDING", invitedById: OTHER, teamId: TEAM_ID };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.teamInvite.findUnique.mockResolvedValue(pending);
    mockPrisma.teamInvite.updateMany.mockResolvedValue({ count: 1 });
  });

  const post = (id = "inv1") =>
    INVITE_REJECT(
      new Request(`http://localhost/api/teams/invites/${id}/reject`, { method: "POST" }),
      { params: Promise.resolve({ id }) },
    );

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await post()).status).toBe(401);
    expect(mockPrisma.teamInvite.updateMany).not.toHaveBeenCalled();
  });

  it("rejects the invite and tells whoever sent it", async () => {
    const response = await post();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockPrisma.teamInvite.updateMany.mock.calls[0][0]).toEqual({
      where: { id: "inv1", userId: "test-user-id", status: "PENDING" },
      data: { status: "REJECTED" },
    });
    expect(mockPublish).toHaveBeenCalledWith({ userId: OTHER, type: "notification" });
  });

  it("answers 404 for an unknown invite", async () => {
    mockPrisma.teamInvite.findUnique.mockResolvedValue(null);

    expect((await post()).status).toBe(404);
  });

  it("answers 403 for an invite addressed to someone else", async () => {
    mockPrisma.teamInvite.findUnique.mockResolvedValue({ ...pending, userId: OTHER });

    expect((await post()).status).toBe(403);
    expect(mockPrisma.teamInvite.updateMany).not.toHaveBeenCalled();
  });

  it("answers 400 when the invite is no longer pending", async () => {
    mockPrisma.teamInvite.findUnique.mockResolvedValue({ ...pending, status: "ACCEPTED" });

    expect((await post()).status).toBe(400);
    expect(mockPrisma.teamInvite.updateMany).not.toHaveBeenCalled();
  });

  it("answers 409 when the invite changed between the read and the update", async () => {
    mockPrisma.teamInvite.updateMany.mockResolvedValue({ count: 0 });

    const response = await post();

    // A checagem de PENDING acontece na leitura, mas quem decide de verdade é o
    // update condicional. Se outra pessoa aceitar o convite no intervalo, o
    // count volta 0 e a rota recusa em vez de sobrescrever o estado dela.
    expect(response.status).toBe(409);
  });

  it("does not notify when the invite has no sender recorded", async () => {
    mockPrisma.teamInvite.findUnique.mockResolvedValue({ ...pending, invitedById: null });

    await post();

    expect(mockPublish).not.toHaveBeenCalled();
  });
});

describe("POST /api/teams/[slug]/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, members: [canPost] });
    mockPrisma.block.findMany.mockResolvedValue([]);
    mockPrisma.post.create.mockResolvedValue({ id: "p1", content: "Vitória" });
  });

  const post = (body: Record<string, unknown>) =>
    TEAM_POST(
      new Request(`http://localhost/api/teams/${SLUG}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      slugParams,
    );

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await post({ content: "x" })).status).toBe(401);
    expect(mockPrisma.post.create).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown slug", async () => {
    mockPrisma.team.findUnique.mockResolvedValue(null);

    expect((await post({ content: "x" })).status).toBe(404);
  });

  it("answers 403 for a member who cannot post and creates nothing", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, members: [noRights] });

    expect((await post({ content: "x" })).status).toBe(403);
    expect(mockPrisma.post.create).not.toHaveBeenCalled();
  });

  it("creates the post on behalf of the team and answers 201", async () => {
    const response = await post({ content: "Vitória no campeonato" });

    expect(response.status).toBe(201);
    expect(mockPrisma.post.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ content: "Vitória no campeonato", teamId: TEAM_ID }),
    );
  });

  it("refuses an empty content", async () => {
    expect((await post({ content: "" })).status).toBe(400);
    expect(mockPrisma.post.create).not.toHaveBeenCalled();
  });
});
