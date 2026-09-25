import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cloudinary } from "@/lib/cloudinary";
import { deleteCloudinaryAsset, getCloudinaryAsset } from "@/lib/cloudinary";

const enabled = process.env.RUN_CLOUDINARY_TESTS === "true" && Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
const imageData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForMissing(publicId: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    if ((await getCloudinaryAsset(publicId, "image")) === null) return;
    await wait(1000);
  }
  throw new Error("Cloudinary asset was not removed");
}

describe.skipIf(!enabled)("Cloudinary integration", () => {
  it("uploads, validates, and idempotently deletes an owned asset", async () => {
    const publicId = `cheerconnect/test/${randomUUID()}`;
    try {
      const uploaded = await cloudinary.uploader.upload(`data:image/png;base64,${imageData}`, {
        public_id: publicId,
        resource_type: "image",
        overwrite: false,
      });
      const remote = await getCloudinaryAsset(publicId, "image");

      expect(uploaded.public_id).toBe(publicId);
      expect(remote?.bytes).toBe(uploaded.bytes);
      expect(await deleteCloudinaryAsset(publicId, "image")).toBe(true);
      expect(await deleteCloudinaryAsset(publicId, "image")).toBe(true);
      await waitForMissing(publicId);
    } finally {
      await deleteCloudinaryAsset(publicId, "image");
    }
  });
});
