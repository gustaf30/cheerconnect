// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "@/test/api-helpers";

const { mockPrisma, mockGetServerSession, mockLogActivity } = vi.hoisted(() => {
  const fn = () => vi.fn();
  const model = () => ({
    findUnique: fn(), findFirst: fn(), findMany: fn(),
    create: fn(), update: fn(), delete: fn(), count: fn(),
  });
  return {
    mockPrisma: {
      report: model(),
      post: model(),
      comment: model(),
      user: model(),
    },
    mockGetServerSession: fn(),
    mockLogActivity: fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: (...args: unknown[]) => mockGetServerSession(...args) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/audit", () => ({ logActivity: mockLogActivity }));

import { GET, POST, PATCH } from "@/app/api/reports/route";

const POST_ID = "p1";
const COMMENT_ID = "c1";
const USER_ID = "u1";
const REPORT_ID = "r1";

function postRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/reports", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validReport = {
  reason: "Conteúdo ofensivo",
  description: "Linguagem agressiva no post",
  contentType: "post",
  contentId: POST_ID,
};

describe("POST /api/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.post.findUnique.mockResolvedValue({ id: POST_ID });
    mockPrisma.comment.findUnique.mockResolvedValue({ id: COMMENT_ID });
    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID });
    mockPrisma.report.findFirst.mockResolvedValue(null);
    mockPrisma.report.create.mockResolvedValue({ id: REPORT_ID });
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await POST(postRequest(validReport));

    expect(response.status).toBe(401);
    expect(mockPrisma.report.create).not.toHaveBeenCalled();
  });

  it("files a report for an existing post and answers 201", async () => {
    const response = await POST(postRequest(validReport));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.report).toEqual({ id: REPORT_ID });
    expect(mockPrisma.report.create.mock.calls[0][0].data).toEqual({
      reason: "Conteúdo ofensivo",
      description: "Linguagem agressiva no post",
      contentType: "post",
      contentId: POST_ID,
      reporterId: "test-user-id",
    });
  });

  it("checks existence against the table that matches the content type", async () => {
    await POST(postRequest({ ...validReport, contentType: "comment", contentId: COMMENT_ID }));
    expect(mockPrisma.comment.findUnique).toHaveBeenCalledWith({ where: { id: COMMENT_ID } });
    expect(mockPrisma.post.findUnique).not.toHaveBeenCalled();
  });

  it("answers 404 and does not file when the post does not exist", async () => {
    mockPrisma.post.findUnique.mockResolvedValue(null);

    const response = await POST(postRequest(validReport));

    expect(response.status).toBe(404);
    expect(mockPrisma.report.create).not.toHaveBeenCalled();
  });

  it("answers 404 when the reported user does not exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const response = await POST(postRequest({ ...validReport, contentType: "user", contentId: USER_ID }));

    expect(response.status).toBe(404);
    expect(mockPrisma.report.create).not.toHaveBeenCalled();
  });

  it("refuses a second report from the same user for the same content", async () => {
    mockPrisma.report.findFirst.mockResolvedValue({ id: REPORT_ID });

    const response = await POST(postRequest(validReport));

    expect(response.status).toBe(400);
    expect(mockPrisma.report.create).not.toHaveBeenCalled();
    // A unicidade é do par (quem denunciou, o quê), não do conteúdo: duas
    // pessoas distintas podem denunciar a mesma publicação.
    expect(mockPrisma.report.findFirst.mock.calls[0][0].where).toEqual({
      reporterId: "test-user-id",
      contentType: "post",
      contentId: POST_ID,
    });
  });

  it("refuses an empty reason", async () => {
    const response = await POST(postRequest({ ...validReport, reason: "" }));

    expect(response.status).toBe(400);
    expect(mockPrisma.report.create).not.toHaveBeenCalled();
  });

  it("refuses a content type outside the allowed set", async () => {
    const response = await POST(postRequest({ ...validReport, contentType: "equipe" }));

    expect(response.status).toBe(400);
    expect(mockPrisma.report.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.user.findUnique.mockResolvedValue({ isAdmin: true });
    mockPrisma.report.findMany.mockResolvedValue([]);
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost:3000/api/reports"));

    expect(response.status).toBe(401);
    expect(mockPrisma.report.findMany).not.toHaveBeenCalled();
  });

  it("answers 403 for a user who is not an administrator", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isAdmin: false });

    const response = await GET(new Request("http://localhost:3000/api/reports"));

    expect(response.status).toBe(403);
    expect(mockPrisma.report.findMany).not.toHaveBeenCalled();
  });

  it("answers 403 when the user record is missing", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost:3000/api/reports"));

    expect(response.status).toBe(403);
  });

  it("marks the listing as private so a shared cache cannot keep it", async () => {
    const response = await GET(new Request("http://localhost:3000/api/reports"));

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("filters by status when one is given", async () => {
    await GET(new Request("http://localhost:3000/api/reports?status=PENDING"));
    expect(mockPrisma.report.findMany.mock.calls[0][0].where).toEqual({ status: "PENDING" });
  });

  it("refuses a status outside the enum", async () => {
    const response = await GET(new Request("http://localhost:3000/api/reports?status=QUALQUER"));

    expect(response.status).toBe(400);
    expect(mockPrisma.report.findMany).not.toHaveBeenCalled();
  });

  it("hydrates the reported post so the moderator sees the content", async () => {
    mockPrisma.report.findMany.mockResolvedValue([
      { id: REPORT_ID, contentType: "post", contentId: POST_ID },
    ]);
    mockPrisma.post.findUnique.mockResolvedValue({ id: POST_ID, content: "texto" });

    const data = await (await GET(new Request("http://localhost:3000/api/reports"))).json();

    expect(data.reports[0].content).toEqual({ id: POST_ID, content: "texto" });
  });
});

describe("PATCH /api/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockPrisma.user.findUnique.mockResolvedValue({ isAdmin: true });
    mockPrisma.report.update.mockResolvedValue({ id: REPORT_ID, status: "RESOLVED" });
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ id: REPORT_ID, status: "RESOLVED" }));

    expect(response.status).toBe(401);
    expect(mockPrisma.report.update).not.toHaveBeenCalled();
  });

  it("answers 403 for a user who is not an administrator", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isAdmin: false });

    const response = await PATCH(patchRequest({ id: REPORT_ID, status: "RESOLVED" }));

    expect(response.status).toBe(403);
    expect(mockPrisma.report.update).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it("records the moderator and the resolution time", async () => {
    await PATCH(patchRequest({ id: REPORT_ID, status: "RESOLVED", resolutionNote: "Removido" }));
    const data = mockPrisma.report.update.mock.calls[0][0].data;

    expect(data.status).toBe("RESOLVED");
    expect(data.resolutionNote).toBe("Removido");
    expect(data.moderatorId).toBe("test-user-id");
    expect(data.resolvedAt).toBeInstanceOf(Date);
  });

  it("leaves resolvedAt empty while the report is still under review", async () => {
    await PATCH(patchRequest({ id: REPORT_ID, status: "REVIEWED" }));

    // Revisado não é resolvido: marcar a data aqui fecharia a denúncia antes da hora.
    expect(mockPrisma.report.update.mock.calls[0][0].data.resolvedAt).toBeNull();
  });

  it("nulls an absent resolution note instead of storing undefined", async () => {
    await PATCH(patchRequest({ id: REPORT_ID, status: "DISMISSED" }));

    expect(mockPrisma.report.update.mock.calls[0][0].data.resolutionNote).toBeNull();
  });

  it("writes an audit entry for the decision", async () => {
    await PATCH(patchRequest({ id: REPORT_ID, status: "RESOLVED" }));

    expect(mockLogActivity).toHaveBeenCalledWith({
      action: "REPORT_REVIEWED",
      entityType: "report",
      entityId: REPORT_ID,
      actorId: "test-user-id",
      metadata: { status: "RESOLVED" },
    });
  });

  it("refuses a status outside the resolution set", async () => {
    const response = await PATCH(patchRequest({ id: REPORT_ID, status: "PENDING" }));

    expect(response.status).toBe(400);
    expect(mockPrisma.report.update).not.toHaveBeenCalled();
  });
});
