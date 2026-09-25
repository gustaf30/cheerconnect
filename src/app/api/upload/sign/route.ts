import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, internalError } from "@/lib/api-utils";
import { cloudinary } from "@/lib/cloudinary";
import { ALLOWED_UPLOAD_FORMATS, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE } from "@/lib/constants";
import { createPendingMediaAsset } from "@/lib/media-assets";
import { canonicalMediaFolder } from "@/lib/media-url";
import { MediaPurpose } from "@prisma/client";
const ALLOWED_FORMATS = ALLOWED_UPLOAD_FORMATS.join(",");

/**
 * POST /api/upload/sign
 * Generate a signed Cloudinary upload payload so the client can upload directly
 * to Cloudinary, bypassing Vercel's 4.5MB body size limit.
 */
export async function POST(request: Request = new Request("http://localhost:3000/api/upload/sign")) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const resourceType = z
      .enum(["image", "video"])
      .parse(new URL(request.url).searchParams.get("resourceType") || "image");

    const maxFileSize = resourceType === "video" ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    const timestamp = Math.round(Date.now() / 1000);
    const folder = `${canonicalMediaFolder(session.user.id)}/posts`;
    const { assetId, uploadToken } = await createPendingMediaAsset({
      ownerId: session.user.id,
      purpose: MediaPurpose.POST,
      resourceType,
    });
    const params = {
      allowed_formats: ALLOWED_FORMATS,
      max_file_size: maxFileSize,
      timestamp,
      folder,
    };

    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET!
    );

    return NextResponse.json({
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY!,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
      folder,
      allowedFormats: ALLOWED_FORMATS,
      maxFileSize,
      assetId,
      uploadToken,
    });
  } catch (err) {
    return internalError("Erro ao gerar assinatura de upload", err);
  }
}
