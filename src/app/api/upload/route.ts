import { NextRequest, NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { cloudinary } from "@/lib/cloudinary";

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

    // Converter arquivo para base64 para upload no Cloudinary
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    // Fazer upload no Cloudinary
    const result = await cloudinary.uploader.upload(base64, {
      folder: "cheerconnect/posts",
      resource_type: isVideo ? "video" : "image",
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
