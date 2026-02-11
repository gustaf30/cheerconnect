import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET /api/settings/username?username=xxx - Verificar disponibilidade do username
export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    // Validar formato
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

    // Disponível se nenhum usuário encontrado ou se é o username do usuário atual
    const available = !existingUser || existingUser.id === session.user.id;

    return NextResponse.json({ available });
  } catch (error) {
    return internalError("Erro ao verificar username", error);
  }
}
