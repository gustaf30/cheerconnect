import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";

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
      {
        error: error.issues[0].message,
        errors: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }
  return null;
}

/**
 * Loga o erro e retorna resposta 500 padronizada.
 */
export function internalError(context: string, error: unknown): NextResponse {
  logger.error({ err: error }, context);
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

/**
 * Retorna IDs de usuários bloqueados (bidirecional).
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const [blockedByMe, blockedMe] = await Promise.all([
    prisma.block.findMany({ where: { userId }, select: { blockedUserId: true } }),
    prisma.block.findMany({ where: { blockedUserId: userId }, select: { userId: true } }),
  ]);
  return [
    ...blockedByMe.map((b) => b.blockedUserId),
    ...blockedMe.map((b) => b.userId),
  ];
}

/**
 * Retorna IDs de usuários conectados (conexões aceitas).
 */
export async function getConnectedUserIds(userId: string): Promise<string[]> {
  const connections = await prisma.connection.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    select: { senderId: true, receiverId: true },
  });
  return connections.map((c) =>
    c.senderId === userId ? c.receiverId : c.senderId
  );
}

/**
 * Verifica se o usuário é participante de uma conversa.
 * Retorna a conversa com participant IDs, ou null se não encontrada/sem acesso.
 */
export async function getConversationWithAccessCheck(
  conversationId: string,
  userId: string
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      participant1Id: true,
      participant2Id: true,
      lastMessageAt: true,
      lastMessagePreview: true,
      createdAt: true,
      participant1: {
        select: { id: true, name: true, username: true, avatar: true },
      },
      participant2: {
        select: { id: true, name: true, username: true, avatar: true },
      },
    },
  });

  if (!conversation) return null;
  if (conversation.participant1Id !== userId && conversation.participant2Id !== userId) return null;

  return conversation;
}

/**
 * Helper para metadados de paginação por cursor.
 */
export function cursorPaginationMeta<T extends Record<string, unknown>>(
  items: T[],
  limit: number,
  cursorField: keyof T = "id" as keyof T
) {
  const hasMore = items.length === limit;
  const nextCursor = hasMore && items.length > 0
    ? String(items[items.length - 1][cursorField])
    : null;
  return { hasMore, nextCursor };
}
