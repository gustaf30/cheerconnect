// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "@/test/api-helpers";

const { mockPrisma, mockGetServerSession } = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    mockPrisma: {
      event: { findMany: fn(), create: fn(), findUnique: fn(), update: fn(), delete: fn() },
      team: { findUnique: fn() },
      teamMember: { findFirst: fn(), count: fn(), update: fn() },
      user: { findUnique: fn() },
    },
    mockGetServerSession: fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: (...args: unknown[]) => mockGetServerSession(...args) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { GET, POST } from "@/app/api/events/route";

describe("events API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
  });

  it("combines text and location filters and keeps personalized responses private", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    const response = await GET(new Request("http://localhost/api/events?scope=all&q=copa&location=S%C3%A3o%20Paulo"));
    const query = mockPrisma.event.findMany.mock.calls[0][0];

    expect(response.status).toBe(200);
    expect(query.where.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({ OR: expect.arrayContaining([expect.objectContaining({ name: expect.any(Object) })]) }),
      expect.objectContaining({ OR: expect.arrayContaining([expect.objectContaining({ location: expect.any(Object) })]) }),
    ]));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("rejects an event whose end precedes its start", async () => {
    const response = await POST(new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Copa",
        location: "São Paulo",
        startDate: "2026-09-25T10:00:00.000Z",
        endDate: "2026-09-24T10:00:00.000Z",
        type: "COMPETITION",
      }),
    }));

    expect(response.status).toBe(400);
    expect(mockPrisma.event.create).not.toHaveBeenCalled();
  });
});
