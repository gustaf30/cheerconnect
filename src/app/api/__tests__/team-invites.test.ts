// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "@/test/api-helpers";

const { mockPrisma, mockGetServerSession } = vi.hoisted(() => {
  const fn = () => vi.fn();
  const model = () => ({
    findUnique: fn(), findFirst: fn(), findMany: fn(),
    create: fn(), update: fn(), delete: fn(), count: fn(),
    upsert: fn(),
  });
  return {
    mockPrisma: {
      user: model(),
      team: model(),
      teamMember: model(),
      teamInvite: model(),
      notification: { create: fn(), findMany: fn() },
      activityLog: { create: fn().mockReturnValue({ catch: fn() }) },
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
vi.mock("@/lib/audit", () => ({
  logActivity: vi.fn(),
}));

import { POST, GET } from "@/app/api/teams/[slug]/invites/route";

function makeParams(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe("POST /api/teams/[slug]/invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/teams/my-team/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2" }),
    });
    const response = await POST(request, makeParams("my-team"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when team does not exist", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);
    mockPrisma.team.findUnique.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/teams/nonexistent/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2" }),
    });
    const response = await POST(request, makeParams("nonexistent"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBeDefined();
  });

  it("returns 403 when user has no permission to invite", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      name: "My Team",
      members: [],
    });

    const request = new Request("http://localhost:3000/api/teams/my-team/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2" }),
    });
    const response = await POST(request, makeParams("my-team"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBeDefined();
  });

  it("returns 403 when non-admin tries to grant isAdmin", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      name: "My Team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: false, isActive: true }],
    });

    const request = new Request("http://localhost:3000/api/teams/my-team/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2", isAdmin: true }),
    });
    const response = await POST(request, makeParams("my-team"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("administrador");
  });

  it("returns 403 when non-admin tries to grant hasPermission", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      name: "My Team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: false, isActive: true }],
    });

    const request = new Request("http://localhost:3000/api/teams/my-team/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2", hasPermission: true }),
    });
    const response = await POST(request, makeParams("my-team"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("permiss");
  });

  it("returns 404 when target user does not exist", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      name: "My Team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: true, isActive: true }],
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/teams/my-team/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "nonexistent-user" }),
    });
    const response = await POST(request, makeParams("my-team"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBeDefined();
  });

  it("returns 400 when user is already an active member", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      name: "My Team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: true, isActive: true }],
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-2", name: "User 2", notifyTeamInvite: true });
    mockPrisma.teamMember.findUnique.mockResolvedValue({ userId: "user-2", teamId: "team-1", isActive: true });

    const request = new Request("http://localhost:3000/api/teams/my-team/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2" }),
    });
    const response = await POST(request, makeParams("my-team"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("membro");
  });

  it("returns 400 when pending invite already exists", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      name: "My Team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: true, isActive: true }],
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-2", name: "User 2", notifyTeamInvite: true });
    mockPrisma.teamMember.findUnique.mockResolvedValue(null);
    mockPrisma.teamInvite.findUnique.mockResolvedValue({ id: "inv-1", status: "PENDING" });

    const request = new Request("http://localhost:3000/api/teams/my-team/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2" }),
    });
    const response = await POST(request, makeParams("my-team"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("convite pendente");
  });

  it("creates invite and notification successfully", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      name: "My Team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: true, isActive: true }],
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-2", name: "User 2", notifyTeamInvite: true });
    mockPrisma.teamMember.findUnique.mockResolvedValue(null);
    mockPrisma.teamInvite.findUnique.mockResolvedValue(null);

    const createdInvite = {
      id: "invite-1",
      teamId: "team-1",
      userId: "user-2",
      role: "Atleta",
      hasPermission: false,
      isAdmin: false,
      status: "PENDING",
      user: { id: "user-2", name: "User 2", username: "user2", avatar: null },
    };
    mockPrisma.teamInvite.upsert.mockResolvedValue(createdInvite);
    mockPrisma.notification.create.mockResolvedValue({});

    const request = new Request("http://localhost:3000/api/teams/my-team/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2", role: "Atleta" }),
    });
    const response = await POST(request, makeParams("my-team"));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.invite.id).toBe("invite-1");
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-2",
          type: "TEAM_INVITE",
          actorId: "test-user-id",
        }),
      })
    );
  });

  it("does not create notification when user has team invite notifications disabled", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      name: "My Team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: true, isActive: true }],
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-2", name: "User 2", notifyTeamInvite: false });
    mockPrisma.teamMember.findUnique.mockResolvedValue(null);
    mockPrisma.teamInvite.findUnique.mockResolvedValue(null);
    mockPrisma.teamInvite.upsert.mockResolvedValue({
      id: "invite-1",
      user: { id: "user-2", name: "User 2", username: "user2", avatar: null },
    });

    const request = new Request("http://localhost:3000/api/teams/my-team/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2" }),
    });
    const response = await POST(request, makeParams("my-team"));

    expect(response.status).toBe(201);
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  it("admin can grant isAdmin and hasPermission", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      name: "My Team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: true, isActive: true }],
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-2", name: "User 2", notifyTeamInvite: false });
    mockPrisma.teamMember.findUnique.mockResolvedValue(null);
    mockPrisma.teamInvite.findUnique.mockResolvedValue(null);
    mockPrisma.teamInvite.upsert.mockResolvedValue({
      id: "invite-1",
      hasPermission: true,
      isAdmin: true,
      user: { id: "user-2", name: "User 2", username: "user2", avatar: null },
    });

    const request = new Request("http://localhost:3000/api/teams/my-team/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2", hasPermission: true, isAdmin: true }),
    });
    const response = await POST(request, makeParams("my-team"));

    expect(response.status).toBe(201);
    expect(mockPrisma.teamInvite.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          hasPermission: true,
          isAdmin: true,
        }),
      })
    );
  });

  it("strips HTML from role field", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      name: "My Team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: true, isActive: true }],
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-2", name: "User 2", notifyTeamInvite: false });
    mockPrisma.teamMember.findUnique.mockResolvedValue(null);
    mockPrisma.teamInvite.findUnique.mockResolvedValue(null);
    mockPrisma.teamInvite.upsert.mockResolvedValue({
      id: "invite-1",
      user: { id: "user-2", name: "User 2", username: "user2", avatar: null },
    });

    const request = new Request("http://localhost:3000/api/teams/my-team/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2", role: "<b>Atleta</b>" }),
    });
    const response = await POST(request, makeParams("my-team"));

    expect(response.status).toBe(201);
    expect(mockPrisma.teamInvite.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          role: "Atleta",
        }),
      })
    );
  });
});

describe("GET /api/teams/[slug]/invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/teams/my-team/invites");
    const response = await GET(request, makeParams("my-team"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when team does not exist", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);
    mockPrisma.team.findUnique.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/teams/nonexistent/invites");
    const response = await GET(request, makeParams("nonexistent"));

    expect(response.status).toBe(404);
  });

  it("returns 403 when user has no permission to view invites", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      name: "My Team",
      members: [],
    });

    const request = new Request("http://localhost:3000/api/teams/my-team/invites");
    const response = await GET(request, makeParams("my-team"));

    expect(response.status).toBe(403);
  });

  it("returns pending invites for authorized member", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      name: "My Team",
      members: [{ userId: "test-user-id", hasPermission: true, isActive: true }],
    });

    const mockInvites = [
      {
        id: "invite-1",
        teamId: "team-1",
        userId: "user-2",
        role: "Atleta",
        status: "PENDING",
        user: { id: "user-2", name: "User 2", username: "user2", avatar: null },
        createdAt: new Date(),
      },
    ];
    mockPrisma.teamInvite.findMany.mockResolvedValue(mockInvites);

    const request = new Request("http://localhost:3000/api/teams/my-team/invites");
    const response = await GET(request, makeParams("my-team"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.invites).toHaveLength(1);
    expect(data.invites[0].id).toBe("invite-1");
    expect(data.nextCursor).toBeNull();
  });
});
