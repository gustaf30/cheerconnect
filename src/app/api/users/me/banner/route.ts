import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cloudinary, deleteCloudinaryAsset } from "@/lib/cloudinary";

// POST /api/users/me/banner - Upload banner to Cloudinary
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

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

    // Get current banner publicId to delete later
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { bannerPublicId: true },
    });

    // Upload to Cloudinary
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64, {
      folder: "cheerconnect/banners",
      resource_type: "image",
    });

    // Update user in DB
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

    // Delete old asset from Cloudinary (fire-and-forget)
    if (currentUser?.bannerPublicId) {
      deleteCloudinaryAsset(currentUser.bannerPublicId).catch((err) =>
        console.error("Failed to delete old banner from Cloudinary:", err)
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Upload banner error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/me/banner - Remove banner
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Get current publicId
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

    // Delete from Cloudinary (fire-and-forget)
    if (currentUser?.bannerPublicId) {
      deleteCloudinaryAsset(currentUser.bannerPublicId).catch((err) =>
        console.error("Failed to delete banner from Cloudinary:", err)
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Delete banner error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
