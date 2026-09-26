// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "@/test/api-helpers";

const { mockPrisma, mockGetServerSession } = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    mockPrisma: {
      careerHistory: { findMany: fn(), findFirst: fn(), create: fn(), update: fn(), delete: fn() },
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

import { GET, POST } from "@/app/api/career/route";
import {
  GET as GET_ONE,
  PATCH,
  DELETE,
} from "@/app/api/career/[id]/route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function postRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/career", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchRequest(id: string, body: Record<string, unknown>) {
  return new Request(`http://localhost:3000/api/career/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validEntry = {
  role: "ATHLETE",
  positions: ["FLYER", "BACKSPOT"],
  startDate: "2024-01-15T00:00:00.000Z",
  teamName: "Cheer Squad Ponta Grossa",
};

describe("GET /api/career", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.careerHistory.findMany.mockResolvedValue([]);
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost:3000/api/career"));

    expect(response.status).toBe(401);
    expect(mockPrisma.careerHistory.findMany).not.toHaveBeenCalled();
  });

  it("scopes the query to the session user and puts current entries first", async () => {
    await GET(new Request("http://localhost:3000/api/career"));
    const query = mockPrisma.careerHistory.findMany.mock.calls[0][0];

    expect(query.where).toEqual({ userId: "test-user-id" });
    expect(query.orderBy).toEqual([
      { isCurrent: "desc" },
      { startDate: "desc" },
      { id: "desc" },
    ]);
  });

  it("reads one extra row to detect the next page and reports the cursor", async () => {
    mockPrisma.careerHistory.findMany.mockResolvedValue([
      { id: "c1" },
      { id: "c2" },
      { id: "c3" },
    ]);

    const response = await GET(new Request("http://localhost:3000/api/career?limit=2"));
    const data = await response.json();
    const query = mockPrisma.careerHistory.findMany.mock.calls[0][0];

    expect(query.take).toBe(3);
    expect(data.careerHistory).toHaveLength(2);
    expect(data.nextCursor).toBe("c2");
  });

  it("has no next cursor on the last page", async () => {
    mockPrisma.careerHistory.findMany.mockResolvedValue([{ id: "c1" }]);

    const data = await (await GET(new Request("http://localhost:3000/api/career"))).json();

    expect(data.nextCursor).toBeNull();
  });

  it("turns the cursor into a skip so the next page does not repeat the last row", async () => {
    await GET(new Request("http://localhost:3000/api/career?cursor=c9"));
    const query = mockPrisma.careerHistory.findMany.mock.calls[0][0];

    expect(query.skip).toBe(1);
    expect(query.cursor).toEqual({ id: "c9" });
  });
});

describe("POST /api/career", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.careerHistory.create.mockResolvedValue({ id: "c1" });
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await POST(postRequest(validEntry));

    expect(response.status).toBe(401);
    expect(mockPrisma.careerHistory.create).not.toHaveBeenCalled();
  });

  it("stores the entry against the session user and answers 201", async () => {
    const response = await POST(postRequest(validEntry));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.career).toEqual({ id: "c1" });
    expect(mockPrisma.careerHistory.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ userId: "test-user-id", teamName: "Cheer Squad Ponta Grossa" }),
    );
  });

  it("refuses a current entry that also carries an end date", async () => {
    const response = await POST(
      postRequest({ ...validEntry, isCurrent: true, endDate: "2025-01-15T00:00:00.000Z" }),
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.careerHistory.create).not.toHaveBeenCalled();
  });

  it("refuses an end date before the start date", async () => {
    const response = await POST(
      postRequest({
        ...validEntry,
        startDate: "2025-01-15T00:00:00.000Z",
        endDate: "2024-01-15T00:00:00.000Z",
      }),
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.careerHistory.create).not.toHaveBeenCalled();
  });

  it("refuses a missing team name", async () => {
    const { teamName: _omitted, ...withoutTeam } = validEntry;

    const response = await POST(postRequest(withoutTeam));

    expect(response.status).toBe(400);
    expect(mockPrisma.careerHistory.create).not.toHaveBeenCalled();
  });

  it("caps the position list at ten entries", async () => {
    const positions = Array.from({ length: 11 }, () => "FLYER");

    const response = await POST(postRequest({ ...validEntry, positions }));

    expect(response.status).toBe(400);
    expect(mockPrisma.careerHistory.create).not.toHaveBeenCalled();
  });

  it("defaults positions to an empty list and isCurrent to false", async () => {
    await POST(postRequest({ role: "COACH", startDate: "2024-01-15T00:00:00.000Z", teamName: "Squad" }));

    expect(mockPrisma.careerHistory.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ positions: [], isCurrent: false }),
    );
  });
});

describe("GET /api/career/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET_ONE(
      new Request("http://localhost:3000/api/career/c1"),
      params("c1"),
    );

    expect(response.status).toBe(401);
  });

  it("finds the entry by id and owner", async () => {
    mockPrisma.careerHistory.findFirst.mockResolvedValue({ id: "c1" });

    const response = await GET_ONE(
      new Request("http://localhost:3000/api/career/c1"),
      params("c1"),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.careerHistory.findFirst.mock.calls[0][0].where).toEqual({
      id: "c1",
      userId: "test-user-id",
    });
  });

  it("answers 404 for an entry owned by someone else", async () => {
    mockPrisma.careerHistory.findFirst.mockResolvedValue(null);

    const response = await GET_ONE(
      new Request("http://localhost:3000/api/career/c1"),
      params("c1"),
    );

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/career/[id]", () => {
  const stored = {
    id: "c1",
    startDate: new Date("2024-01-15T00:00:00.000Z"),
    endDate: new Date("2025-01-15T00:00:00.000Z"),
    isCurrent: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.careerHistory.findFirst.mockResolvedValue(stored);
    mockPrisma.careerHistory.update.mockResolvedValue({ id: "c1" });
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await PATCH(patchRequest("c1", { teamName: "Outro" }), params("c1"));

    expect(response.status).toBe(401);
    expect(mockPrisma.careerHistory.update).not.toHaveBeenCalled();
  });

  it("keeps the stored end date when the patch does not mention it", async () => {
    const response = await PATCH(patchRequest("c1", { teamName: "Outro squad" }), params("c1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.career).toEqual({ id: "c1" });
    // O bug aqui seria enviar endDate: undefined e sobrescrever o vínculo.
    expect(mockPrisma.careerHistory.update.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ teamName: "Outro squad" }),
    );
    expect(mockPrisma.careerHistory.update.mock.calls[0][0].data).not.toHaveProperty("endDate");
  });

  it("rejects marking the entry current without clearing the stored end date", async () => {
    const response = await PATCH(patchRequest("c1", { isCurrent: true }), params("c1"));

    expect(response.status).toBe(400);
    expect(mockPrisma.careerHistory.update).not.toHaveBeenCalled();
  });

  it("accepts marking current in the same patch that clears the end date", async () => {
    const response = await PATCH(
      patchRequest("c1", { isCurrent: true, endDate: null }),
      params("c1"),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.careerHistory.update.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ isCurrent: true, endDate: null }),
    );
  });

  it("disconnects the team when the patch sends an empty team id", async () => {
    await PATCH(patchRequest("c1", { teamId: null }), params("c1"));

    expect(mockPrisma.careerHistory.update.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ team: { disconnect: true } }),
    );
  });

  it("connects the team when the patch sends a team id", async () => {
    await PATCH(patchRequest("c1", { teamId: "t1" }), params("c1"));

    expect(mockPrisma.careerHistory.update.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ team: { connect: { id: "t1" } } }),
    );
  });

  it("answers 404 without updating an entry owned by someone else", async () => {
    mockPrisma.careerHistory.findFirst.mockResolvedValue(null);

    const response = await PATCH(patchRequest("c1", { teamName: "Outro" }), params("c1"));

    expect(response.status).toBe(404);
    expect(mockPrisma.careerHistory.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/career/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost:3000/api/career/c1", { method: "DELETE" }),
      params("c1"),
    );

    expect(response.status).toBe(401);
    expect(mockPrisma.careerHistory.delete).not.toHaveBeenCalled();
  });

  it("deletes the entry owned by the session user", async () => {
    mockPrisma.careerHistory.findFirst.mockResolvedValue({ id: "c1" });

    const response = await DELETE(
      new Request("http://localhost:3000/api/career/c1", { method: "DELETE" }),
      params("c1"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockPrisma.careerHistory.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });

  it("answers 404 without deleting an entry owned by someone else", async () => {
    mockPrisma.careerHistory.findFirst.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost:3000/api/career/c1", { method: "DELETE" }),
      params("c1"),
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.careerHistory.delete).not.toHaveBeenCalled();
  });
});
