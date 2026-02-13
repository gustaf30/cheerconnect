import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { handleZodError, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  username: z
    .string()
    .min(3, "Username deve ter pelo menos 3 caracteres")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username pode conter apenas letras, números e underline"
    ),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, username, password } = registerSchema.parse(body);

    // Verificar se o email ou username já existem (single query)
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return NextResponse.json(
          { error: "Este email já está em uso" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Este username já está em uso" },
        { status: 400 }
      );
    }

    // Criptografar senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        name,
        email,
        username,
        password: hashedPassword,
      },
    });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleZodError(error) ?? internalError("Erro ao registrar usuário", error);
  }
}
