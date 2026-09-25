// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockDeleteUserMediaAssets } = vi.hoisted(() => ({
  mockPrisma: {
    privacyRequest: { findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    teamMember: { findMany: vi.fn() },
    activityLog: { updateMany: vi.fn() },
    user: { delete: vi.fn() },
    $transaction: vi.fn(),
  },
  mockDeleteUserMediaAssets: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/media-assets", () => ({
  deleteUserMediaAssets: mockDeleteUserMediaAssets,
  backfillLegacyMediaAssets: vi.fn().mockResolvedValue({ candidates: 0, created: 0, skipped: 0 }),
  reconcileCompletedMediaAssets: vi.fn().mockResolvedValue({ checked: 0, missing: 0, errors: 0 }),
}));
vi.mock("@/lib/cloudinary", () => ({ deleteCloudinaryAsset: vi.fn().mockResolvedValue(true) }));

import { processDeletePrivacyRequests } from "@/app/api/cron/maintenance/route";

describe("privacy deletion maintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.privacyRequest.count.mockResolvedValue(0);
    mockPrisma.teamMember.findMany.mockResolvedValue([]);
    mockPrisma.activityLog.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.delete.mockResolvedValue({ id: "user-1" });
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma));
  });

  it("claims a stale processing request and completes it", async () => {
    mockPrisma.privacyRequest.findMany.mockResolvedValue([{ id: "privacy-1", userId: "user-1", attempts: 1 }]);
    mockPrisma.privacyRequest.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(processDeletePrivacyRequests()).resolves.toEqual({ completed: 1, rejected: 0, pending: 0 });
    expect(mockPrisma.privacyRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PROCESSING", attempts: { increment: 1 } }),
    }));
    expect(mockDeleteUserMediaAssets).toHaveBeenCalledWith("user-1");
  });

  it("rejects a sole-admin request instead of retrying forever", async () => {
    mockPrisma.privacyRequest.findMany.mockResolvedValue([{ id: "privacy-1", userId: "user-1", attempts: 0 }]);
    mockPrisma.privacyRequest.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    mockPrisma.teamMember.findMany.mockResolvedValue([{ team: { members: [] } }]);

    await expect(processDeletePrivacyRequests()).resolves.toEqual({ completed: 0, rejected: 1, pending: 0 });
    expect(mockPrisma.privacyRequest.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: { status: "REJECTED", processingStartedAt: null, lastError: "SOLE_ADMIN" },
    }));
  });

  it("moves retryable failures back to pending", async () => {
    mockPrisma.privacyRequest.findMany.mockResolvedValue([{ id: "privacy-1", userId: "user-1", attempts: 0 }]);
    mockPrisma.privacyRequest.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    mockDeleteUserMediaAssets.mockRejectedValueOnce(new Error("provider unavailable"));

    await expect(processDeletePrivacyRequests()).resolves.toEqual({ completed: 0, rejected: 0, pending: 0 });
    expect(mockPrisma.privacyRequest.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: { status: "PENDING", processingStartedAt: null, lastError: "RETRYABLE_FAILURE" },
    }));
  });
});
