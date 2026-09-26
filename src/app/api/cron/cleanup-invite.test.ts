// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => {
  const fn = () => vi.fn();
  return { mockPrisma: { teamInvite: { updateMany: fn(), deleteMany: fn() } } };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { GET, POST } from "@/app/api/cron/cleanup-invites/route";

const SECRET = "segredo-de-cron-de-teste";

function request(secret: string | null) {
  // A rota é tipada como NextRequest, então o teste precisa construir um.
  return new NextRequest("http://localhost/api/cron/cleanup-invites", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe("GET /api/cron/cleanup-invites", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
    mockPrisma.teamInvite.updateMany.mockResolvedValue({ count: 3 });
    mockPrisma.teamInvite.deleteMany.mockResolvedValue({ count: 7 });
  });

  afterAll(() => {
    process.env.CRON_SECRET = original;
  });

  it("returns 401 without the cron secret", async () => {
    const response = await GET(request(null));

    expect(response.status).toBe(401);
    expect(mockPrisma.teamInvite.updateMany).not.toHaveBeenCalled();
  });

  it("returns 401 when the secret is configured nowhere", async () => {
    delete process.env.CRON_SECRET;

    // Sem CRON_SECRET configurado a rota se recusa, em vez de aceitar qualquer
    // chamada: uma ausência de configuração não pode virar porta aberta.
    expect((await GET(request(null))).status).toBe(401);
    expect(mockPrisma.teamInvite.updateMany).not.toHaveBeenCalled();
  });

  it("returns 401 for a wrong secret", async () => {
    expect((await GET(request("outro-segredo"))).status).toBe(401);
  });

  it("expires only pending invites that are past their date", async () => {
    await GET(request(SECRET));

    const where = mockPrisma.teamInvite.updateMany.mock.calls[0][0].where;
    expect(where).toEqual({ status: "PENDING", expiresAt: { lt: expect.any(Date) } });
    expect(mockPrisma.teamInvite.updateMany.mock.calls[0][0].data).toEqual({ status: "EXPIRED" });
  });

  it("deletes rejected and expired invites older than 30 days", async () => {
    await GET(request(SECRET));

    const where = mockPrisma.teamInvite.deleteMany.mock.calls[0][0].where;
    // Aceitos e pendentes ficam: a limpeza só remove o que já não tem volta.
    expect(where.status).toEqual({ in: ["EXPIRED", "REJECTED"] });
    expect(where.createdAt).toEqual({ lt: expect.any(Date) });
  });

  it("reports what it changed", async () => {
    const response = await GET(request(SECRET));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.expired).toBe(3);
    expect(data.deleted).toBe(7);
    expect(typeof data.timestamp).toBe("string");
  });

  it("is reachable by POST as well, since the scheduler may use either verb", async () => {
    const response = await POST(request(SECRET));

    expect(response.status).toBe(200);
    expect(mockPrisma.teamInvite.updateMany).toHaveBeenCalled();
  });
});
