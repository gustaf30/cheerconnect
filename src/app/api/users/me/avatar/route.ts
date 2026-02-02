import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/users/me/avatar - Upload avatar (base64)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { avatar } = body;

    if (!avatar || typeof avatar !== "string") {
      return NextResponse.json(
        { error: "Avatar é obrigatório" },
        { status: 400 }
      );
    }

    // Validate that it's a valid data URL
    if (!avatar.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Formato de imagem inválido" },
        { status: 400 }
      );
    }

    // Check file size (base64 is ~33% larger than binary)
    // 5MB binary = ~6.7MB base64
    const base64Data = avatar.split(",")[1];
    if (base64Data && base64Data.length > 7 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Imagem muito grande. Máximo: 5MB" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { avatar },
      select: {
        id: true,
        avatar: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Upload avatar error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/me/avatar - Remove avatar
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { avatar: null },
      select: {
        id: true,
        avatar: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Delete avatar error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
