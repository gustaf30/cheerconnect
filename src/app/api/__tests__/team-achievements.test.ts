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
      team: model(),
      teamMember: model(),
      teamAchievement: model(),
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

import { GET, POST } from "@/app/api/teams/[slug]/achievements/route";
import { DELETE } from "@/app/api/teams/[slug]/achievements/[id]/route";

const SLUG = "cheer-squad";
const TEAM_ID = "t1";
const slugParams = { params: Promise.resolve({ slug: SLUG }) };
const idParams = (id: string) => ({ params: Promise.resolve({ slug: SLUG, id }) });

/** Membro com permissão de edição: getTeamPermissions só olha estes campos. */
const editor = { role: "COACH", canEdit: true, canPost: true, canInvite: true, canManageMembers: true, canDeleteTeam: false };
/** Não usado como retorno de query: o filtro canEdit já esvazia members no DELETE. */
const plainMember = { role: "ATHLETE", canEdit: false, canPost: true, canInvite: false, canManageMembers: false, canDeleteTeam: false };

function postRequest(body: Record<string, unknown>) {
  return new Request(`http://localhost:3000/api/teams/${SLUG}/achievements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validAchievement = {
  title: "Campeonato Regional 2025",
  description: "Primeiro lugar",
  date: "2025-08-10T00:00:00.000Z",
  category: "Competição",
};

describe("GET /api/teams/[slug]/achievements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.block.findMany.mockResolvedValue([]);
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID });
    mockPrisma.teamMember.count.mockResolvedValue(0);
    mockPrisma.teamAchievement.findMany.mockResolvedValue([]);
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET(
      new Request(`http://localhost:3000/api/teams/${SLUG}/achievements`),
      slugParams,
    );

    expect(response.status).toBe(401);
    expect(mockPrisma.teamAchievement.findMany).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown slug", async () => {
    mockPrisma.team.findUnique.mockResolvedValue(null);

    const response = await GET(
      new Request(`http://localhost:3000/api/teams/${SLUG}/achievements`),
      slugParams,
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.teamAchievement.findMany).not.toHaveBeenCalled();
  });

  it("hides the team when it still has a blocked member", async () => {
    mockPrisma.teamMember.count.mockResolvedValue(1);

    const response = await GET(
      new Request(`http://localhost:3000/api/teams/${SLUG}/achievements`),
      slugParams,
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.teamMember.count.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ teamId: TEAM_ID, isActive: true }),
    );
    expect(mockPrisma.teamAchievement.findMany).not.toHaveBeenCalled();
  });

  it("reads the team achievements newest first", async () => {
    await GET(new Request(`http://localhost:3000/api/teams/${SLUG}/achievements`), slugParams);
    const query = mockPrisma.teamAchievement.findMany.mock.calls[0][0];

    expect(query.where).toEqual({ teamId: TEAM_ID });
    expect(query.orderBy).toEqual([{ date: "desc" }, { id: "desc" }]);
  });

  it("reads one extra row and reports the cursor", async () => {
    mockPrisma.teamAchievement.findMany.mockResolvedValue([{ id: "ta1" }, { id: "ta2" }, { id: "ta3" }]);

    const data = await (
      await GET(new Request(`http://localhost:3000/api/teams/${SLUG}/achievements?limit=2`), slugParams)
    ).json();

    expect(data.achievements).toHaveLength(2);
    expect(data.nextCursor).toBe("ta2");
  });
});

describe("POST /api/teams/[slug]/achievements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, members: [editor] });
    mockPrisma.teamAchievement.create.mockResolvedValue({ id: "ta1" });
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await POST(postRequest(validAchievement), slugParams);

    expect(response.status).toBe(401);
    expect(mockPrisma.teamAchievement.create).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown slug", async () => {
    mockPrisma.team.findUnique.mockResolvedValue(null);

    const response = await POST(postRequest(validAchievement), slugParams);

    expect(response.status).toBe(404);
    expect(mockPrisma.teamAchievement.create).not.toHaveBeenCalled();
  });

  it("answers 403 for a member without edit permission and does not create", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, members: [plainMember] });

    const response = await POST(postRequest(validAchievement), slugParams);

    expect(response.status).toBe(403);
    expect(mockPrisma.teamAchievement.create).not.toHaveBeenCalled();
  });

  it("answers 403 for a non-member, who has no permission record at all", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, members: [] });

    const response = await POST(postRequest(validAchievement), slugParams);

    expect(response.status).toBe(403);
    expect(mockPrisma.teamAchievement.create).not.toHaveBeenCalled();
  });

  it("looks the member up as active and able to edit", async () => {
    await POST(postRequest(validAchievement), slugParams);

    expect(mockPrisma.team.findUnique.mock.calls[0][0].include.members.where).toEqual(
      expect.objectContaining({ userId: "test-user-id", isActive: true, canEdit: true }),
    );
  });

  it("creates the achievement bound to the team and answers 201", async () => {
    const response = await POST(postRequest(validAchievement), slugParams);

    expect(response.status).toBe(201);
    expect(mockPrisma.teamAchievement.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ teamId: TEAM_ID, title: "Campeonato Regional 2025" }),
    );
  });

  it("refuses an empty title", async () => {
    const response = await POST(postRequest({ ...validAchievement, title: "  " }), slugParams);

    expect(response.status).toBe(400);
    expect(mockPrisma.teamAchievement.create).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/teams/[slug]/achievements/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await DELETE(
      new Request(`http://localhost:3000/api/teams/${SLUG}/achievements/ta1`, { method: "DELETE" }),
      idParams("ta1"),
    );

    expect(response.status).toBe(401);
    expect(mockPrisma.teamAchievement.delete).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown slug", async () => {
    mockPrisma.team.findUnique.mockResolvedValue(null);

    const response = await DELETE(
      new Request(`http://localhost:3000/api/teams/${SLUG}/achievements/ta1`, { method: "DELETE" }),
      idParams("ta1"),
    );

    expect(response.status).toBe(404);
  });

  it("answers 403 for a member without edit permission and does not delete", async () => {
    // O filtro canEdit está dentro da query do Prisma, então um membro sem
    // permissão volta com members vazio — a equipe existe, o usuário não pode
    // editar. É essa distinção que separa 404 de 403.
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, members: [] });

    const response = await DELETE(
      new Request(`http://localhost:3000/api/teams/${SLUG}/achievements/ta1`, { method: "DELETE" }),
      idParams("ta1"),
    );

    expect(response.status).toBe(403);
    expect(mockPrisma.teamAchievement.delete).not.toHaveBeenCalled();
    expect(mockPrisma.team.findUnique.mock.calls[0][0].include.members.where).toEqual(
      expect.objectContaining({ userId: "test-user-id", isActive: true, canEdit: true }),
    );
  });

  it("answers 404 when the achievement does not exist", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, members: [editor] });
    mockPrisma.teamAchievement.findFirst.mockResolvedValue(null);

    const response = await DELETE(
      new Request(`http://localhost:3000/api/teams/${SLUG}/achievements/ta1`, { method: "DELETE" }),
      idParams("ta1"),
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.teamAchievement.delete).not.toHaveBeenCalled();
  });

  it("deletes the achievement when the member may edit", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, members: [editor] });
    mockPrisma.teamAchievement.findFirst.mockResolvedValue({ id: "ta1" });

    const response = await DELETE(
      new Request(`http://localhost:3000/api/teams/${SLUG}/achievements/ta1`, { method: "DELETE" }),
      idParams("ta1"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockPrisma.teamAchievement.delete).toHaveBeenCalledWith({ where: { id: "ta1" } });
  });
});
