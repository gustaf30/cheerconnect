// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockPing, mockGetRedis } = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    mockPrisma: { $queryRaw: fn() },
    mockPing: fn(),
    mockGetRedis: fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/redis", () => ({ getRedis: () => mockGetRedis() }));

import { GET } from "@/app/api/health/route";

describe("health API", () => {
  beforeEach(() => {
    mockPrisma.$queryRaw.mockReset().mockResolvedValue([{ "1": 1 }]);
    mockGetRedis.mockReset().mockReturnValue(null);
    mockPing.mockReset().mockResolvedValue("PONG");
  });

  it("reports ok when the database and Redis respond", async () => {
    mockGetRedis.mockReturnValue({ ping: mockPing });
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.database).toBe("ok");
    expect(body.redis).toBe("ok");
  });

  it("reports not_configured when Redis is absent", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.redis).toBe("not_configured");
  });

  it("keeps serving 200 when Redis is unavailable", async () => {
    mockGetRedis.mockReturnValue({ ping: mockPing });
    mockPing.mockRejectedValue(new Error("redis down"));
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.redis).toBe("unavailable");
  });

  it("returns 503 when the database fails", async () => {
    mockGetRedis.mockReturnValue({ ping: mockPing });
    mockPrisma.$queryRaw.mockRejectedValue(new Error("db down"));
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.database).toBe("error");
    expect(body.redis).toBe("ok");
  });
});
