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
 */
export async function deleteCloudinaryAsset(
  publicId: string,
  resourceType: "image" | "video" = "image"
): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

/**
 * Delete all Cloudinary assets associated with a post (images + video).
 * Fire-and-forget friendly — errors are logged but not thrown.
 */
export async function deletePostAssets(post: {
  images?: string[];
  videoUrl?: string | null;
}): Promise<void> {
  const promises: Promise<void>[] = [];

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
    await Promise.allSettled(promises);
  }
}
