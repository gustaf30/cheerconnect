import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

/**
 * Extract public ID from a Cloudinary URL.
 * Example: https://res.cloudinary.com/demo/image/upload/v1234/cheerconnect/posts/abc123.jpg
 * Returns: cheerconnect/posts/abc123
 */
export function extractPublicId(url: string): string | null {
  try {
    const regex = /\/upload\/(?:v\d+\/)?(.+)\.\w+$/;
    const match = url.match(regex);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Delete a single asset from Cloudinary by public ID.
 * Retries with exponential backoff on failure.
 */
export async function deleteCloudinaryAsset(
  publicId: string,
  resourceType: "image" | "video" = "image",
  maxRetries = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      return true;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(
          `[cloudinary] Failed to delete ${resourceType} ${publicId} after ${maxRetries} attempts:`,
          error instanceof Error ? error.message : error
        );
        return false;
      }
      // Exponential backoff: 500ms, 1000ms, 2000ms...
      await new Promise((resolve) =>
        setTimeout(resolve, 500 * Math.pow(2, attempt - 1))
      );
    }
  }
  return false;
}

/**
 * Delete all Cloudinary assets associated with a post (images + video).
 * Fire-and-forget friendly — errors are logged but not thrown.
 */
export async function deletePostAssets(post: {
  images?: string[];
  videoUrl?: string | null;
}): Promise<void> {
  const promises: Promise<boolean>[] = [];

  if (post.images) {
    for (const url of post.images) {
      const publicId = extractPublicId(url);
      if (publicId) {
        promises.push(deleteCloudinaryAsset(publicId, "image"));
      }
    }
  }

  if (post.videoUrl) {
    const publicId = extractPublicId(post.videoUrl);
    if (publicId) {
      promises.push(deleteCloudinaryAsset(publicId, "video"));
    }
  }

  if (promises.length > 0) {
    const results = await Promise.allSettled(promises);
    const failed = results.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value)
    ).length;
    if (failed > 0) {
      console.warn(`[cloudinary] ${failed}/${results.length} asset deletions failed for post`);
    }
  }
}
