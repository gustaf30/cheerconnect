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

  if (!(await isSessionTokenValid(session.user.id, session.user.tokenVersion))) {
    return {
      session: null as never,
      error: NextResponse.json(
        { error: "Sessão expirada" },
        { status: 401 }
      ),
    };
  }

  return { session, error: null };
}

export async function isSessionTokenValid(
  userId: string,
  tokenVersion: number | undefined
): Promise<boolean> {
  if (tokenVersion === undefined) return process.env.NODE_ENV !== "production";
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true, emailVerified: true },
  });
  return Boolean(
    currentUser &&
      currentUser.tokenVersion === tokenVersion &&
      currentUser.emailVerified
  );
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
 * Retorna IDs de usuários bloqueados (bidirecional).
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const blockModel = (prisma as unknown as { block?: { findMany?: (args: unknown) => Promise<Array<{ blockedUserId: string }>> } }).block;
  if (!blockModel?.findMany) return [];
  const [blockedByMe, blockedMe] = await Promise.all([
    prisma.block.findMany({ where: { userId }, select: { blockedUserId: true } }),
    prisma.block.findMany({ where: { blockedUserId: userId }, select: { userId: true } }),
  ]);
  return [
    ...(blockedByMe ?? []).map((b) => b.blockedUserId),
    ...(blockedMe ?? []).map((b) => b.userId),
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

export async function areUsersBlocked(firstUserId: string, secondUserId: string): Promise<boolean> {
  const blockModel = (prisma as unknown as { block?: { findFirst?: (args: unknown) => Promise<unknown> } }).block;
  if (!blockModel?.findFirst) return false;
  const block = await blockModel.findFirst({
    where: {
      OR: [
        { userId: firstUserId, blockedUserId: secondUserId },
        { userId: secondUserId, blockedUserId: firstUserId },
      ],
    },
    select: { id: true },
  });
  return Boolean(block);
}

export async function areUsersConnected(firstUserId: string, secondUserId: string): Promise<boolean> {
  const connection = await prisma.connection.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: firstUserId, receiverId: secondUserId },
        { senderId: secondUserId, receiverId: firstUserId },
      ],
    },
    select: { id: true },
  });
  return Boolean(connection);
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

  const otherUserId = conversation.participant1Id === userId
    ? conversation.participant2Id
    : conversation.participant1Id;
  if (await areUsersBlocked(userId, otherUserId)) return null;

  return conversation;
}

/**
 * Extrai e limita o parâmetro "limit" de paginação dos searchParams.
 */
export function parsePaginationLimit(
  searchParams: URLSearchParams,
  defaultLimit = 20,
  maxLimit = 50
): number {
  const raw = parseInt(searchParams.get("limit") || String(defaultLimit));
  return Math.min(raw > 0 ? raw : defaultLimit, maxLimit);
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
