// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAuth, mockApiSignRequest } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockApiSignRequest: vi.fn(),
}));

vi.mock("@/lib/api-utils", () => ({
  requireAuth: mockRequireAuth,
  internalError: vi.fn(),
}));

vi.mock("@/lib/cloudinary", () => ({
  cloudinary: {
    utils: {
      api_sign_request: mockApiSignRequest,
    },
  },
}));

vi.mock("@/lib/media-assets", () => ({
  createPendingMediaAsset: vi.fn().mockResolvedValue({ assetId: "asset-1", uploadToken: "token-1" }),
}));

import { POST } from "@/app/api/upload/sign/route";
import { MAX_IMAGE_SIZE } from "@/lib/constants";

const ALLOWED_FORMATS = "jpg,jpeg,png,gif,webp,webm,mp4";

describe("POST /api/upload/sign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CLOUDINARY_API_KEY", "api-key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "api-secret");
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "cloud-name");
    mockRequireAuth.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } });
    mockApiSignRequest.mockReturnValue("signed-payload");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs and returns an explicit allowlist of upload formats", async () => {
    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockApiSignRequest).toHaveBeenCalledWith(
      {
         allowed_formats: ALLOWED_FORMATS,
         max_file_size: MAX_IMAGE_SIZE,
         timestamp: expect.any(Number),

         folder: "cheerconnect/users/user-1/posts",

      },
      "api-secret"
    );
    expect(data).toMatchObject({
      signature: "signed-payload",
      apiKey: "api-key",
      cloudName: "cloud-name",
       folder: "cheerconnect/users/user-1/posts",

       allowedFormats: ALLOWED_FORMATS,
       maxFileSize: MAX_IMAGE_SIZE,
       assetId: "asset-1",
       uploadToken: "token-1",

    });
  });
});
