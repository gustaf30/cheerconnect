import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { cloudinary, deleteCloudinaryAsset } from "@/lib/cloudinary";
import { validateFileType } from "@/lib/file-validation";
import { registerCompletedMediaAsset } from "@/lib/media-assets";
import { canonicalMediaFolder } from "@/lib/media-url";
import { MediaPurpose } from "@prisma/client";
import { MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS } from "@/lib/constants";
import logger from "@/lib/logger";

// POST /api/users/me/avatar - Upload de avatar para o Cloudinary
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

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Imagem muito grande. Máximo: 5MB" },
        { status: 400 }
      );
    }

    // Validate file type using magic bytes (not spoofable MIME type)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const validation = validateFileType(buffer);
    if (!validation.valid || validation.detectedType !== "image") {
      return NextResponse.json(
        { error: "Tipo de arquivo não suportado. Use JPEG, PNG, GIF ou WebP." },
        { status: 400 }
      );
    }

    if (
      !validation.width ||
      !validation.height ||
      validation.width > MAX_IMAGE_DIMENSION ||
      validation.height > MAX_IMAGE_DIMENSION ||
      validation.width * validation.height > MAX_IMAGE_PIXELS
    ) {
      return NextResponse.json(
        { error: "Dimensões de imagem inválidas ou grandes demais" },
        { status: 400 }
      );
    }

    // Buscar publicId do avatar atual para excluir depois
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { avatarPublicId: true },
    });

    // Upload para o Cloudinary (use validated MIME type, not client-supplied file.type)
    const base64 = `data:${validation.mimeType};base64,${buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64, {
      folder: `${canonicalMediaFolder(session.user.id)}/avatar`,
      resource_type: "image",
    });

    await registerCompletedMediaAsset({
      ownerId: session.user.id,
      url: result.secure_url,
      publicId: result.public_id,
      purpose: MediaPurpose.AVATAR,
      resourceType: "image",
      bytes: file.size,
      width: result.width,
      height: result.height,
      mimeType: validation.mimeType || undefined,
    });

    // Atualizar usuário no banco
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        avatar: result.secure_url,
        avatarPublicId: result.public_id,
      },
      select: {
        id: true,
        avatar: true,
      },
    });

    // Excluir asset antigo do Cloudinary (fire-and-forget)
    if (currentUser?.avatarPublicId) {
      deleteCloudinaryAsset(currentUser.avatarPublicId).catch((err) =>
        logger.error({ err }, "Falha ao excluir avatar antigo do Cloudinary")
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    return internalError("Erro ao fazer upload do avatar", error);
  }
}

// DELETE /api/users/me/avatar - Remover avatar
export async function DELETE() {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    // Buscar publicId atual
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { avatarPublicId: true },
    });

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { avatar: null, avatarPublicId: null },
      select: {
        id: true,
        avatar: true,
      },
    });

    // Excluir do Cloudinary (fire-and-forget)
    if (currentUser?.avatarPublicId) {
      deleteCloudinaryAsset(currentUser.avatarPublicId).catch((err) =>
        logger.error({ err }, "Falha ao excluir avatar do Cloudinary")
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    return internalError("Erro ao excluir avatar", error);
  }
}
