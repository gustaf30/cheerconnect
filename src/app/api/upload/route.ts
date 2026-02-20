import { NextRequest, NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { validateFileType } from "@/lib/file-validation";
import { cloudinary } from "@/lib/cloudinary";
import { Readable } from "stream";
import type { UploadApiResponse } from "cloudinary";

/**
 * POST /api/upload
 * Server-side upload route for small files (avatars, team logos, etc.).
 * Post media (images/videos) now use direct Cloudinary upload via /api/upload/sign.
 */
export async function POST(request: NextRequest) {
  try {
    const contentLength = parseInt(request.headers.get("content-length") || "0");
    const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB (só arquivos pequenos)
    if (contentLength > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 413 }
      );
    }

    const { error } = await requireAuth();
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

    // Validar tamanho do arquivo (10MB para imagens, 100MB para vídeos)
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Máximo: ${isVideo ? "100MB" : "10MB"}` },
        { status: 400 }
      );
    }

    // Upload via stream para evitar overhead de memória base64 (~33% maior)
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "cheerconnect/posts",
          resource_type: isVideo ? "video" : "image",
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error("Upload failed"));
          resolve(result);
        }
      );
      Readable.from(buffer).pipe(uploadStream);
    });

    return NextResponse.json({
      url: result.secure_url,
      type: isVideo ? "video" : "image",
      publicId: result.public_id,
    });
  } catch (error) {
    return internalError("Erro ao fazer upload", error);
  }
}
