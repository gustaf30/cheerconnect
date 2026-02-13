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
      team: model(),
      teamMember: model(),
      notification: { create: fn(), findMany: fn() },
      activityLog: { create: fn().mockReturnValue({ catch: fn() }) },
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
vi.mock("@/lib/audit", () => ({
  logActivity: vi.fn(),
}));

import { PATCH, DELETE } from "@/app/api/teams/[slug]/members/[memberId]/route";

function makeParams(slug: string, memberId: string) {
  return { params: Promise.resolve({ slug, memberId }) };
}

function patchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/teams/my-team/members/member-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/teams/[slug]/members/[memberId] - Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = patchRequest({ role: "Coach" });
    const response = await PATCH(request, makeParams("my-team", "member-1"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when team does not exist", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue(null);

    const request = patchRequest({ role: "Coach" });
    const response = await PATCH(request, makeParams("my-team", "member-1"));

    expect(response.status).toBe(404);
  });

  // Scenario 4: Regular member (no permissions) cannot update any member's role/permissions
  it("returns 403 when user has no hasPermission flag", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: false, isAdmin: false, isActive: true }],
    });

    const request = patchRequest({ role: "Coach" });
    const response = await PATCH(request, makeParams("my-team", "member-1"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("permissão");
  });

  // Scenario 5: Non-member cannot modify team members at all
  it("returns 403 when user is not a member of the team", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [], // current user not in members list
    });

    const request = patchRequest({ role: "Coach" });
    const response = await PATCH(request, makeParams("my-team", "member-1"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("permissão");
  });

  // Scenario 1: Non-admin member cannot grant themselves isAdmin
  it("returns 400 when user tries to change their own permissions (isAdmin)", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: false, isActive: true }],
    });
    // The member being updated is the current user
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "member-self",
      userId: "test-user-id",
      teamId: "team-1",
      hasPermission: true,
      isAdmin: false,
    });

    const request = patchRequest({ isAdmin: true });
    const response = await PATCH(request, makeParams("my-team", "member-self"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("próprias permissões");
  });

  it("returns 400 when user tries to change their own hasPermission", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: true, isActive: true }],
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "member-self",
      userId: "test-user-id",
      teamId: "team-1",
      hasPermission: true,
      isAdmin: true,
    });

    const request = patchRequest({ hasPermission: false });
    const response = await PATCH(request, makeParams("my-team", "member-self"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("próprias permissões");
  });

  // Scenario 1 continued: Self-update of role only (no permission change) is allowed
  it("allows user to change their own role without changing permissions", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: true, isActive: true }],
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "member-self",
      userId: "test-user-id",
      teamId: "team-1",
      hasPermission: true,
      isAdmin: true,
    });

    const updatedMember = {
      id: "member-self",
      userId: "test-user-id",
      role: "Técnico",
      user: { id: "test-user-id", name: "Test User", username: "testuser", avatar: null, positions: [] },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      return fn({
        teamMember: { update: vi.fn().mockResolvedValue(updatedMember), count: vi.fn() },
      });
    });

    const request = patchRequest({ role: "Técnico" });
    const response = await PATCH(request, makeParams("my-team", "member-self"));

    expect(response.status).toBe(200);
  });

  // Scenario 3: Only isAdmin members can manage members who have hasPermission
  it("returns 403 when non-admin tries to modify a member with hasPermission", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: false, isActive: true }],
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "member-target",
      userId: "other-user",
      teamId: "team-1",
      hasPermission: true,
      isAdmin: false,
    });

    const request = patchRequest({ role: "Coach" });
    const response = await PATCH(request, makeParams("my-team", "member-target"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("administradores");
  });

  // Scenario 2: Member with hasPermission cannot modify another member who also has hasPermission
  it("returns 403 when hasPermission member tries to modify another hasPermission member", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: false, isActive: true }],
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "member-2",
      userId: "user-2",
      teamId: "team-1",
      hasPermission: true,
      isAdmin: false,
    });

    const request = patchRequest({ role: "Coreógrafo" });
    const response = await PATCH(request, makeParams("my-team", "member-2"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("administradores");
  });

  it("returns 403 when non-admin tries to modify an admin member", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: false, isActive: true }],
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "admin-member",
      userId: "admin-user",
      teamId: "team-1",
      hasPermission: true,
      isAdmin: true,
    });

    const request = patchRequest({ role: "Atleta" });
    const response = await PATCH(request, makeParams("my-team", "admin-member"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("administradores");
  });

  // Scenario: Non-admin cannot grant hasPermission or isAdmin to anyone
  it("returns 403 when non-admin tries to grant hasPermission to a regular member", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: false, isActive: true }],
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "regular-member",
      userId: "regular-user",
      teamId: "team-1",
      hasPermission: false,
      isAdmin: false,
    });

    const request = patchRequest({ hasPermission: true });
    const response = await PATCH(request, makeParams("my-team", "regular-member"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("administradores");
  });

  it("returns 403 when non-admin tries to grant isAdmin to a regular member", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: false, isActive: true }],
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "regular-member",
      userId: "regular-user",
      teamId: "team-1",
      hasPermission: false,
      isAdmin: false,
    });

    const request = patchRequest({ isAdmin: true });
    const response = await PATCH(request, makeParams("my-team", "regular-member"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("administradores");
  });

  // Happy path: Admin can modify a member with hasPermission
  it("admin can modify a member with hasPermission", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: true, isActive: true }],
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "perm-member",
      userId: "perm-user",
      teamId: "team-1",
      hasPermission: true,
      isAdmin: false,
    });

    const updatedMember = {
      id: "perm-member",
      role: "Coach",
      user: { id: "perm-user", name: "Perm User", username: "permuser", avatar: null, positions: [] },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      return fn({
        teamMember: { update: vi.fn().mockResolvedValue(updatedMember), count: vi.fn() },
      });
    });

    const request = patchRequest({ role: "Coach" });
    const response = await PATCH(request, makeParams("my-team", "perm-member"));

    expect(response.status).toBe(200);
  });

  // Happy path: Admin can grant isAdmin and hasPermission
  it("admin can grant isAdmin to another member", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: true, isActive: true }],
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "regular-member",
      userId: "regular-user",
      teamId: "team-1",
      hasPermission: false,
      isAdmin: false,
    });

    const updatedMember = {
      id: "regular-member",
      isAdmin: true,
      hasPermission: true,
      user: { id: "regular-user", name: "Regular", username: "regular", avatar: null, positions: [] },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      return fn({
        teamMember: { update: vi.fn().mockResolvedValue(updatedMember), count: vi.fn() },
      });
    });

    const request = patchRequest({ isAdmin: true, hasPermission: true });
    const response = await PATCH(request, makeParams("my-team", "regular-member"));

    expect(response.status).toBe(200);
  });

  // hasPermission member can modify regular members (role only)
  it("hasPermission member can change role of a regular member", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: false, isActive: true }],
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "regular-member",
      userId: "regular-user",
      teamId: "team-1",
      hasPermission: false,
      isAdmin: false,
    });

    const updatedMember = {
      id: "regular-member",
      role: "Backspot",
      user: { id: "regular-user", name: "Regular", username: "regular", avatar: null, positions: [] },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      return fn({
        teamMember: { update: vi.fn().mockResolvedValue(updatedMember), count: vi.fn() },
      });
    });

    const request = patchRequest({ role: "Backspot" });
    const response = await PATCH(request, makeParams("my-team", "regular-member"));

    expect(response.status).toBe(200);
  });

  it("returns 404 when target member does not exist", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: true, isActive: true }],
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue(null);

    const request = patchRequest({ role: "Coach" });
    const response = await PATCH(request, makeParams("my-team", "nonexistent"));

    expect(response.status).toBe(404);
  });

  it("returns 404 when target member belongs to a different team", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: true, isActive: true }],
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "member-other-team",
      userId: "other-user",
      teamId: "team-2", // different team
      hasPermission: false,
      isAdmin: false,
    });

    const request = patchRequest({ role: "Coach" });
    const response = await PATCH(request, makeParams("my-team", "member-other-team"));

    expect(response.status).toBe(404);
  });

  it("returns 400 when trying to remove the last admin", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: true, isActive: true }],
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "other-admin",
      userId: "other-admin-user",
      teamId: "team-1",
      hasPermission: true,
      isAdmin: true,
    });

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      return fn({
        teamMember: {
          count: vi.fn().mockResolvedValue(1), // only 1 admin
          update: vi.fn(),
        },
      });
    });

    const request = patchRequest({ isAdmin: false });
    const response = await PATCH(request, makeParams("my-team", "other-admin"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("administrador");
  });
});

describe("DELETE /api/teams/[slug]/members/[memberId] - Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/teams/my-team/members/member-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, makeParams("my-team", "member-1"));

    expect(response.status).toBe(401);
  });

  it("returns 403 when non-member tries to delete a member", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [],
    });

    const request = new Request("http://localhost:3000/api/teams/my-team/members/member-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, makeParams("my-team", "member-1"));

    expect(response.status).toBe(403);
  });

  it("returns 400 when user tries to remove themselves", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: true, isActive: true }],
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "self-member",
      userId: "test-user-id",
      teamId: "team-1",
      isAdmin: true,
      hasPermission: true,
      user: { id: "test-user-id", name: "Test User" },
    });

    const request = new Request("http://localhost:3000/api/teams/my-team/members/self-member", {
      method: "DELETE",
    });
    const response = await DELETE(request, makeParams("my-team", "self-member"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("remover");
  });

  it("returns 403 when non-admin tries to remove a hasPermission member", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: false, isActive: true }],
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "perm-member",
      userId: "perm-user",
      teamId: "team-1",
      hasPermission: true,
      isAdmin: false,
      user: { id: "perm-user", name: "Perm User" },
    });

    const request = new Request("http://localhost:3000/api/teams/my-team/members/perm-member", {
      method: "DELETE",
    });
    const response = await DELETE(request, makeParams("my-team", "perm-member"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("administradores");
  });

  it("returns 403 when non-admin tries to remove an admin member", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      slug: "my-team",
      members: [{ userId: "test-user-id", hasPermission: true, isAdmin: false, isActive: true }],
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "admin-member",
      userId: "admin-user",
      teamId: "team-1",
      hasPermission: true,
      isAdmin: true,
      user: { id: "admin-user", name: "Admin User" },
    });

    const request = new Request("http://localhost:3000/api/teams/my-team/members/admin-member", {
      method: "DELETE",
    });
    const response = await DELETE(request, makeParams("my-team", "admin-member"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("administradores");
  });
});
