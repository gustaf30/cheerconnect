import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockResource, mockDestroy } = vi.hoisted(() => ({
  mockResource: vi.fn(),
  mockDestroy: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("cloudinary", () => ({
  v2: {
    config: vi.fn(),
    api: { resource: mockResource },
    uploader: { destroy: mockDestroy },
  },
}));

import { deleteCloudinaryAsset, getCloudinaryAsset } from "@/lib/cloudinary";

describe("Cloudinary helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDINARY_CLOUD_NAME = "cloud";
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = "secret";
  });

  it("normalizes a missing remote asset to null", async () => {
    mockResource.mockRejectedValueOnce({ error: { http_code: 404 } });

    await expect(getCloudinaryAsset("asset", "image")).resolves.toBeNull();
  });

  it("treats already deleted assets as idempotent success", async () => {
    mockDestroy.mockResolvedValueOnce({ result: "not found" });

    await expect(deleteCloudinaryAsset("asset", "image")).resolves.toBe(true);
  });

  it("does not report success without provider credentials", async () => {
    delete process.env.CLOUDINARY_API_SECRET;

    await expect(deleteCloudinaryAsset("asset", "image")).resolves.toBe(false);
    expect(mockDestroy).not.toHaveBeenCalled();
  });

  it("propagates provider failures after retries", async () => {
    mockDestroy.mockRejectedValue(new Error("provider unavailable"));

    await expect(deleteCloudinaryAsset("asset", "image", 1)).resolves.toBe(false);
  });
});
