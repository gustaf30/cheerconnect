import { NextRequest, NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { cloudinary } from "@/lib/cloudinary";
import { Readable } from "stream";
import type { UploadApiResponse } from "cloudinary";

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    }

    // Validar tipo do arquivo
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: "Tipo de arquivo não suportado. Use imagens ou vídeos." },
        { status: 400 }
      );
    }

    // Validar tamanho do arquivo (10MB para imagens, 100MB para vídeos)
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Máximo: ${isVideo ? "100MB" : "10MB"}` },
        { status: 400 }
      );
    }

    // Upload via stream to avoid base64 memory overhead (~33% larger)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

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
