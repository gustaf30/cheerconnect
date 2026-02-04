import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/users/me/banner - Upload banner (base64)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { banner } = body;

    if (!banner || typeof banner !== "string") {
      return NextResponse.json(
        { error: "Banner é obrigatório" },
        { status: 400 }
      );
    }

    // Validate that it's a valid data URL
    if (!banner.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Formato de imagem inválido" },
        { status: 400 }
      );
    }

    // Check file size (base64 is ~33% larger than binary)
    // 5MB binary = ~6.7MB base64
    const base64Data = banner.split(",")[1];
    if (base64Data && base64Data.length > 7 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Imagem muito grande. Máximo: 5MB" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { banner },
      select: {
        id: true,
        banner: true,
      },
    });

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

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { banner: null },
      select: {
        id: true,
        banner: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Delete banner error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
