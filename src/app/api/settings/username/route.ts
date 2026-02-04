import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/settings/username?username=xxx - Check username availability
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    // Validate format
    if (!username || username.length < 3) {
      return NextResponse.json({
        available: false,
        error: "Username deve ter pelo menos 3 caracteres",
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({
        available: false,
        error: "Username pode conter apenas letras, números e _",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    // Available if no user found or if it's the current user's username
    const available = !existingUser || existingUser.id === session.user.id;

    return NextResponse.json({ available });
  } catch (error) {
    console.error("Check username error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
