import { NextRequest, NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { validateFileType } from "@/lib/file-validation";
import { cloudinary } from "@/lib/cloudinary";
import { Readable } from "stream";
import type { UploadApiResponse } from "cloudinary";
import { MediaPurpose } from "@prisma/client";
import {
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
} from "@/lib/constants";
import { registerCompletedMediaAsset } from "@/lib/media-assets";
import { canonicalMediaFolder } from "@/lib/media-url";

/**
 * POST /api/upload
 * Server-side upload route for small files (avatars, team logos, etc.).
 * Post media (images/videos) now use direct Cloudinary upload via /api/upload/sign.
 */
export async function POST(request: NextRequest) {
  try {
    const contentLength = parseInt(request.headers.get("content-length") || "0");
    const MAX_REQUEST_SIZE = MAX_VIDEO_SIZE;
    if (contentLength > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${Math.round(MAX_REQUEST_SIZE / 1024 / 1024)}MB.` },
        { status: 413 }
      );
    }

    const { session, error } = await requireAuth();
    if (error) return error;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    }

    // Ler buffer e validar via magic bytes (bloqueia SVG + MIME types falsificados)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const validation = validateFileType(buffer);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Tipo de arquivo não suportado. Use imagens (JPEG, PNG, GIF, WebP) ou vídeos (MP4, WebM)." },
        { status: 400 }
      );
    }

    const isVideo = validation.detectedType === "video";

    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Máximo: ${isVideo ? "100MB" : "10MB"}` },
        { status: 400 }
      );
    }

    if (
      !isVideo &&
      (!validation.width ||
        !validation.height ||
        validation.width > MAX_IMAGE_DIMENSION ||
        validation.height > MAX_IMAGE_DIMENSION ||
        validation.width * validation.height > MAX_IMAGE_PIXELS)
    ) {
      return NextResponse.json(
        { error: "Dimensões de imagem inválidas ou grandes demais" },
        { status: 400 }
      );
    }

    // Upload via stream para evitar overhead de memória base64 (~33% maior)
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `${canonicalMediaFolder(session.user.id)}/posts`,
          resource_type: isVideo ? "video" : "image",
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error("Upload failed"));
          resolve(result);
        }
      );
      Readable.from(buffer).pipe(uploadStream);
    });

    try {
      const asset = await registerCompletedMediaAsset({
        ownerId: session.user.id,
        url: result.secure_url,
        publicId: result.public_id,
        purpose: MediaPurpose.POST,
        resourceType: isVideo ? "video" : "image",
        bytes: file.size,
        width: result.width,
        height: result.height,
        mimeType: validation.mimeType || undefined,
      });

      return NextResponse.json({
        url: result.secure_url,
        type: isVideo ? "video" : "image",
        publicId: result.public_id,
        assetId: asset.id,
      });
    } catch (assetError) {
      await cloudinary.uploader.destroy(result.public_id, {
        resource_type: isVideo ? "video" : "image",
      });
      throw assetError;
    }
  } catch (error) {
    return internalError("Erro ao fazer upload", error);
  }
}
