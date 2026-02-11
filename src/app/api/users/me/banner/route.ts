import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { cloudinary, deleteCloudinaryAsset } from "@/lib/cloudinary";

// POST /api/users/me/banner - Upload de banner para o Cloudinary
export async function POST(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não enviado" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Arquivo deve ser uma imagem" },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Imagem muito grande. Máximo: 5MB" },
        { status: 400 }
      );
    }

    // Buscar publicId do banner atual para excluir depois
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { bannerPublicId: true },
    });

    // Upload para o Cloudinary
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64, {
      folder: "cheerconnect/banners",
      resource_type: "image",
    });

    // Atualizar usuário no banco
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        banner: result.secure_url,
        bannerPublicId: result.public_id,
      },
      select: {
        id: true,
        banner: true,
      },
    });

    // Excluir asset antigo do Cloudinary (fire-and-forget)
    if (currentUser?.bannerPublicId) {
      deleteCloudinaryAsset(currentUser.bannerPublicId).catch((err) =>
        console.error("Falha ao excluir banner antigo do Cloudinary:", err)
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    return internalError("Erro ao fazer upload do banner", error);
  }
}

// DELETE /api/users/me/banner - Remover banner
export async function DELETE() {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    // Buscar publicId atual
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { bannerPublicId: true },
    });

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { banner: null, bannerPublicId: null },
      select: {
        id: true,
        banner: true,
      },
    });

    // Excluir do Cloudinary (fire-and-forget)
    if (currentUser?.bannerPublicId) {
      deleteCloudinaryAsset(currentUser.bannerPublicId).catch((err) =>
        console.error("Falha ao excluir banner do Cloudinary:", err)
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    return internalError("Erro ao excluir banner", error);
  }
}
