import { v2 as cloudinary } from "cloudinary";
import logger from "./logger";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

function isCloudinaryNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as {
    http_code?: unknown;
    error?: { http_code?: unknown };
    response?: { statusCode?: unknown };
  };
  return value.http_code === 404 || value.error?.http_code === 404 || value.response?.statusCode === 404;
}

export async function getCloudinaryAsset(
  publicId: string,
  resourceType: "image" | "video"
): Promise<{
  public_id: string;
  secure_url: string;
  bytes?: number;
  width?: number;
  height?: number;
  format?: string;
} | null> {
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return null;
  }
  try {
    return await cloudinary.api.resource(publicId, { resource_type: resourceType });
  } catch (error) {
    if (isCloudinaryNotFound(error)) return null;
    throw error;
  }
}

/**
 * Extract public ID from a Cloudinary URL.
 * Example: https://res.cloudinary.com/demo/image/upload/v1234/cheerconnect/posts/abc123.jpg
 * Returns: cheerconnect/posts/abc123
 */
export function extractPublicId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = "/upload/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) return null;

    let value = parsed.pathname.slice(markerIndex + marker.length);
    value = value.replace(/^v\d+\//, "");
    value = value.replace(/\.[a-z0-9]+$/i, "");
    return value || null;
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
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return false;
  }
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      if (result.result === "ok" || result.result === "not found") return true;
      throw new Error(`Resposta inesperada do Cloudinary: ${result.result}`);
    } catch (error) {
      if (attempt === maxRetries) {
        logger.error(
          { err: error, publicId, resourceType },
          `[cloudinary] falha ao deletar após ${maxRetries} tentativas`
        );
        return false;
      }
      // Backoff exponencial: 500ms, 1000ms, 2000ms...
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
      logger.warn(`[cloudinary] ${failed}/${results.length} deleções de assets falharam para post`);
    }
  }
}
