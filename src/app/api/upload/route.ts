import { NextRequest, NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { validateFileType } from "@/lib/file-validation";
import { cloudinary } from "@/lib/cloudinary";
import { Readable } from "stream";
import type { UploadApiResponse } from "cloudinary";

/** Minimum bytes needed for magic byte validation (RIFF+WEBP = 12 bytes) */
const HEADER_SIZE = 12;

export async function POST(request: NextRequest) {
  try {
    const contentLength = parseInt(request.headers.get("content-length") || "0");
    const MAX_REQUEST_SIZE = 100 * 1024 * 1024; // 100MB
    if (contentLength > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 100MB." },
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

    // Read only the header bytes for magic byte validation (not the entire file)
    const headerSlice = await file.slice(0, HEADER_SIZE).arrayBuffer();
    const headerBuffer = Buffer.from(headerSlice);

    const validation = validateFileType(headerBuffer);
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

    // Stream the file to Cloudinary without buffering entirely in memory
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
      Readable.fromWeb(file.stream() as import("stream/web").ReadableStream).pipe(uploadStream);
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
