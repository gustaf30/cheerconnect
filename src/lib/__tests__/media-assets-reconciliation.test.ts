// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockRemote } = vi.hoisted(() => ({
  mockPrisma: {
    post: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    mediaAsset: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  mockRemote: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/cloudinary", () => ({
  getCloudinaryAsset: mockRemote,
  extractPublicId: vi.fn((value: string) => value.split("/upload/")[1]?.replace(/^v\d+\//, "").replace(/\.[^.]+$/, "") || null),
}));

import { backfillLegacyMediaAssets, reconcileCompletedMediaAssets } from "@/lib/media-assets";

describe("media asset reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDINARY_CLOUD_NAME = "demo";
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = "secret";
    mockPrisma.mediaAsset.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });
  });

  it("backfills only canonical legacy URLs and preserves existing records", async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      {
        id: "post-1",
        authorId: "user-1",
        images: [
          "https://res.cloudinary.com/demo/image/upload/v1/cheerconnect/users/user-1/legacy.jpg",
          "https://res.cloudinary.com/demo/image/upload/v1/cheerconnect/users/user-2/other.jpg",
        ],
        videoUrl: null,
      },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        avatar: "https://res.cloudinary.com/demo/image/upload/v1/cheerconnect/users/user-1/avatar.jpg",
        banner: null,
      },
    ]);
    mockPrisma.mediaAsset.findMany.mockResolvedValue([{ url: "https://res.cloudinary.com/demo/image/upload/v1/cheerconnect/users/user-1/avatar.jpg" }]);

    await expect(backfillLegacyMediaAssets()).resolves.toEqual({ candidates: 2, created: 1, skipped: 1 });
    expect(mockPrisma.mediaAsset.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ ownerId: "user-1", purpose: "POST" })],
      skipDuplicates: true,
    }));
  });

  it("marks a missing remote asset for retry without deleting its record", async () => {
    mockPrisma.mediaAsset.findMany.mockResolvedValue([
      { id: "asset-1", publicId: "cheerconnect/users/user-1/old.jpg", resourceType: "image" },
    ]);
    mockRemote.mockResolvedValue(null);

    await expect(reconcileCompletedMediaAssets()).resolves.toEqual({ checked: 1, missing: 1, errors: 0 });
    expect(mockPrisma.mediaAsset.updateMany).toHaveBeenCalledWith({
      where: { id: "asset-1", status: "COMPLETED" },
      data: { status: "FAILED" },
    });
  });

  it("does not reconcile when provider credentials are absent", async () => {
    delete process.env.CLOUDINARY_API_SECRET;

    await expect(reconcileCompletedMediaAssets()).resolves.toEqual({ checked: 0, missing: 0, errors: 0 });
    expect(mockPrisma.mediaAsset.findMany).not.toHaveBeenCalled();
  });
});
