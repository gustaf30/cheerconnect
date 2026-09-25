// @vitest-environment node
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockDelete } = vi.hoisted(() => ({
  mockPrisma: {
    mediaAsset: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    post: { findUnique: vi.fn() },
  },
  mockDelete: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/cloudinary", () => ({
  deleteCloudinaryAsset: mockDelete,
  getCloudinaryAsset: vi.fn().mockResolvedValue(null),
  extractPublicId: vi.fn((value: string) => value.split("/upload/")[1]?.replace(/^v\d+\//, "").replace(/\.[^.]+$/, "") || null),
}));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn() } }));

import { completePendingMediaAsset, linkPostMediaAssets } from "@/lib/media-assets";

describe("media asset ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an asset whose public ID belongs to another user", async () => {
    mockPrisma.mediaAsset.findUnique.mockResolvedValue({
      id: "asset-1",
      ownerId: "user-1",
      status: "PENDING",
      uploadTokenHash: createHash("sha256").update("token").digest("hex"),
    });
    await expect(completePendingMediaAsset({
      assetId: "asset-1",
      ownerId: "user-1",
      uploadToken: "token",
      url: "https://res.cloudinary.com/demo/image/upload/v1/cheerconnect/users/user-2/posts/a.jpg",
      publicId: "cheerconnect/users/user-2/posts/a",
    })).rejects.toThrow("não pertence");
    expect(mockPrisma.mediaAsset.update).not.toHaveBeenCalled();
  });

  it("refuses to link a completed asset from another owner", async () => {
    mockPrisma.mediaAsset.findMany.mockResolvedValue([]);
    await expect(linkPostMediaAssets("post-1", "user-1", ["https://res.cloudinary.com/demo/image/upload/v1/a.jpg"])).rejects.toThrow(
      "não pertencem"
    );
    expect(mockPrisma.mediaAsset.updateMany).not.toHaveBeenCalled();
  });
});
