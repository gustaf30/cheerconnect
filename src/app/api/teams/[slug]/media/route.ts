import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { cloudinary, deleteCloudinaryAsset } from "@/lib/cloudinary";
import { validateFileType } from "@/lib/file-validation";
import { registerCompletedMediaAsset } from "@/lib/media-assets";
import { canonicalMediaFolder } from "@/lib/media-url";
import { getTeamPermissions } from "@/lib/team-permissions";
import { MediaPurpose } from "@prisma/client";
import { MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS, MAX_IMAGE_SIZE } from "@/lib/constants";

const kindSchema = z.enum(["logo", "banner"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { slug } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    const kind = kindSchema.safeParse(formData.get("kind"));

    if (!(file instanceof File) || !kind.success) {
      return NextResponse.json({ error: "Arquivo ou tipo inválido" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "Imagem muito grande. Máximo: 10MB" }, { status: 400 });
    }

    const team = await prisma.team.findUnique({
      where: { slug },
      include: {
        members: {
          where: { userId: session.user.id, isActive: true },
        },
      },
    });
    if (!team) return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
    if (!getTeamPermissions(team.members[0]).canEdit) {
      return NextResponse.json({ error: "Você não tem permissão para editar a equipe" }, { status: 403 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const validation = validateFileType(bytes);
    if (!validation.valid || validation.detectedType !== "image" || !validation.width || !validation.height) {
      return NextResponse.json({ error: "Tipo de imagem inválido" }, { status: 400 });
    }
    if (
      validation.width > MAX_IMAGE_DIMENSION ||
      validation.height > MAX_IMAGE_DIMENSION ||
      validation.width * validation.height > MAX_IMAGE_PIXELS
    ) {
      return NextResponse.json({ error: "Dimensões de imagem grandes demais" }, { status: 400 });
    }

    const result = await cloudinary.uploader.upload(
      `data:${validation.mimeType};base64,${bytes.toString("base64")}`,
      {
        folder: `${canonicalMediaFolder(session.user.id)}/teams/${team.id}`,
        resource_type: "image",
      }
    );

    const purpose = kind.data === "logo" ? MediaPurpose.TEAM_LOGO : MediaPurpose.TEAM_BANNER;
    await registerCompletedMediaAsset({
      ownerId: session.user.id,
      url: result.secure_url,
      publicId: result.public_id,
      purpose,
      resourceType: "image",
      bytes: file.size,
      width: result.width,
      height: result.height,
      mimeType: validation.mimeType || undefined,
      teamId: team.id,
    });

    const oldPublicId = kind.data === "logo" ? team.logoPublicId : team.bannerPublicId;
    const updatedTeam = await prisma.team.update({
      where: { id: team.id },
      data: kind.data === "logo"
        ? { logo: result.secure_url, logoPublicId: result.public_id }
        : { banner: result.secure_url, bannerPublicId: result.public_id },
      select: { id: true, logo: true, logoPublicId: true, banner: true, bannerPublicId: true },
    });

    if (oldPublicId) {
      deleteCloudinaryAsset(oldPublicId).catch(() => undefined);
    }

    return NextResponse.json({ team: updatedTeam });
  } catch (error) {
    return internalError("Erro ao enviar mídia da equipe", error);
  }
}
