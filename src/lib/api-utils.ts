import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";

/**
 * Verifica autenticação e retorna a sessão do usuário.
 * Uso: const { session, error } = await requireAuth();
 *      if (error) return error;
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      session: null as never,
      error: NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      ),
    };
  }
  return { session, error: null };
}

/**
 * Trata erros de validação Zod, retornando resposta 400.
 * Retorna null se o erro não for Zod (para encadear com internalError).
 */
export function handleZodError(error: unknown): NextResponse | null {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: error.issues[0].message },
      { status: 400 }
    );
  }
  return null;
}

/**
 * Loga o erro e retorna resposta 500 padronizada.
 */
export function internalError(context: string, error: unknown): NextResponse {
  console.error(`${context}:`, error);
  return NextResponse.json(
    { error: "Erro interno do servidor" },
    { status: 500 }
  );
}

/**
 * Standard success response envelope.
 */
export function apiSuccess<T>(
  data: T,
  meta?: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json({ data, ...(meta && { meta }) }, { status });
}

/**
 * Standard error response envelope.
 */
export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
