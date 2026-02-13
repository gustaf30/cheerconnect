// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "@/test/api-helpers";
import { Prisma } from "@prisma/client";

const { mockPrisma, mockGetServerSession } = vi.hoisted(() => {
  const fn = () => vi.fn();
  const model = () => ({
    findUnique: fn(), findFirst: fn(), findMany: fn(),
    create: fn(), update: fn(), delete: fn(), count: fn(),
  });
  return {
    mockPrisma: {
      user: model(),
      post: model(),
      connection: model(),
      team: model(),
      teamMember: model(),
      teamFollow: { findMany: fn() },
      notification: { create: fn(), findMany: fn() },
      tag: { upsert: fn() },
      postTag: { create: fn(), deleteMany: fn() },
      mention: { create: fn(), deleteMany: fn() },
      block: { findFirst: fn(), findMany: fn() },
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

import { GET, POST } from "@/app/api/teams/route";

describe("GET /api/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/teams");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns teams list for authenticated user", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    const mockTeams = [
      {
        id: "team-1",
        name: "Cheer Squad",
        slug: "cheer-squad",
        logo: null,
        location: "Sao Paulo",
        category: "ALLSTAR",
        level: "Level 5",
        _count: { members: 10 },
      },
    ];
    mockPrisma.team.findMany.mockResolvedValue(mockTeams);

    const request = new Request("http://localhost:3000/api/teams");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.teams).toHaveLength(1);
    expect(data.teams[0].name).toBe("Cheer Squad");
  });
});

describe("POST /api/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Team" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 201 with team data and creator as admin", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    const createdTeam = {
      id: "new-team-id",
      name: "New Team",
      slug: "new-team",
      description: null,
      location: null,
      category: "ALLSTAR",
      level: null,
    };
    mockPrisma.team.create.mockResolvedValue(createdTeam);

    const request = new Request("http://localhost:3000/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Team" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.team.id).toBe("new-team-id");
    expect(data.team.slug).toBe("new-team");

    const createCall = mockPrisma.team.create.mock.calls[0][0];
    expect(createCall.data.members.create).toEqual(
      expect.objectContaining({
        userId: "test-user-id",
        hasPermission: true,
        isAdmin: true,
      })
    );
  });

  it("generates slug from team name correctly", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.team.create.mockResolvedValue({
      id: "team-id",
      name: "Stars & Stripes Team!",
      slug: "stars-stripes-team",
      description: null,
      location: null,
      category: "ALLSTAR",
      level: null,
    });

    const request = new Request("http://localhost:3000/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Stars & Stripes Team!" }),
    });
    await POST(request);

    const createCall = mockPrisma.team.create.mock.calls[0][0];
    expect(createCall.data.slug).toBe("stars-stripes-team");
  });

  it("appends counter when slug already exists", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    // First create throws P2002 (slug conflict), second succeeds with counter
    mockPrisma.team.create
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "5.0.0",
        })
      )
      .mockResolvedValueOnce({
        id: "team-id",
        name: "My Team",
        slug: "my-team-1",
        description: null,
        location: null,
        category: "ALLSTAR",
        level: null,
      });

    const request = new Request("http://localhost:3000/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "My Team" }),
    });
    await POST(request);

    // First attempt uses base slug, second attempt appends counter
    expect(mockPrisma.team.create).toHaveBeenCalledTimes(2);
    const secondCall = mockPrisma.team.create.mock.calls[1][0];
    expect(secondCall.data.slug).toBe("my-team-1");
  });

  it("returns 400 for missing required fields", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    const request = new Request("http://localhost:3000/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 for name that is too short", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    const request = new Request("http://localhost:3000/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "A" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("handles accented characters in slug generation", async () => {
    const session = mockSession();
    mockGetServerSession.mockResolvedValue(session);

    mockPrisma.team.create.mockResolvedValue({
      id: "team-id",
      name: "Equipe Sao Paulo",
      slug: "equipe-sao-paulo",
      description: null,
      location: null,
      category: "ALLSTAR",
      level: null,
    });

    const request = new Request("http://localhost:3000/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Equipe Sao Paulo" }),
    });
    await POST(request);

    const createCall = mockPrisma.team.create.mock.calls[0][0];
    expect(createCall.data.slug).toBe("equipe-sao-paulo");
  });
});
