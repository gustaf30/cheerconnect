// Helpers de API e de banco para os E2E destrutivos.
//
// A divisão é deliberada: o caminho principal do usuário é dirigido pelo browser
// (é o que pega componente quebrado, estado de loading e erro de render), e a API
// entra para montar o cenário e para cobrir o que a interface não expõe.

import type { APIRequestContext, Page } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { authenticate, getDb, type TestUser } from "./auth";

// Espelha ACCOUNT_REAUTH_TTL_MS de src/lib/account-reauth.ts. Copiado em vez de
// importado porque aquele módulo cria o Prisma no import, o que abriria um
// segundo pool só para ler uma constante.
const REAUTH_TTL_MS = 10 * 60 * 1000;

export type ApiResponse<T = unknown> = { status: number; body: T };

export async function api<T = unknown>(
  request: APIRequestContext,
  method: "get" | "post" | "put" | "patch" | "delete",
  path: string,
  data?: unknown,
): Promise<ApiResponse<T>> {
  const response = await request[method](path, data === undefined ? {} : { data });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // resposta sem JSON não é erro; o chamador decide o que fazer com o texto
  }
  return { status: response.status(), body: body as T };
}

export type PostRow = { id: string; content: string; authorId: string };

export async function createPost(
  request: APIRequestContext,
  content: string,
): Promise<{ status: number; post: PostRow | null }> {
  const created = await api<{ post?: PostRow }>(request, "post", "/api/posts", { content });
  return { status: created.status, post: created.body?.post ?? null };
}

export type ConnectionRow = { id: string; status: string; receiverId: string };

export async function requestConnection(
  request: APIRequestContext,
  receiverId: string,
): Promise<{ status: number; connection: ConnectionRow | null }> {
  const created = await api<{ connection?: ConnectionRow }>(request, "post", "/api/connections", {
    receiverId,
  });
  return { status: created.status, connection: created.body?.connection ?? null };
}

/**
 * Aceita um pedido pendente.
 *
 * O `[id]` da rota é o id de QUEM SOLICITOU, não o da conexão — o mesmo desenho
 * de DELETE /api/connections/[id]. Passar o id da conexão devolve 404.
 */
export async function acceptConnectionFrom(request: APIRequestContext, senderId: string) {
  return api(request, "post", `/api/connections/${senderId}/accept`);
}

/**
 * Completa o handshake de conexão entre dois usuários e devolve a sessão
 * autenticada como o primeiro.
 *
 * Mensagens exigem conexão aceita: `POST /api/conversations` responde 403 para
 * quem não tem conexão com o destinatário. É uma decisão de privacidade — não
 * se conversa com estranhos — e por isso o teste de mensagens precisa passar
 * por aqui em vez de criar a conversa direto.
 */
export async function connectPair(page: Page, from: TestUser, to: TestUser) {
  await authenticate(page, from);
  const requested = await requestConnection(page.request, to.id);
  if (requested.status !== 201) {
    throw new Error(`solicitação de conexão falhou com ${requested.status}`);
  }
  await authenticate(page, to);
  const accepted = await acceptConnectionFrom(page.request, from.id);
  if (accepted.status !== 200) {
    throw new Error(`aceite de conexão falhou com ${accepted.status}`);
  }
  await authenticate(page, from);
  return requested.connection!.id;
}

export async function createConversation(
  request: APIRequestContext,
  participantId: string,
): Promise<{ status: number; conversationId: string | null }> {
  const created = await api<{ conversation?: { id: string } }>(request, "post", "/api/conversations", {
    participantId,
  });
  return { status: created.status, conversationId: created.body?.conversation?.id ?? null };
}

export async function sendMessage(
  request: APIRequestContext,
  conversationId: string,
  content: string,
) {
  return api<{ message?: { id: string } }>(request, "post", `/api/conversations/${conversationId}/messages`, {
    content,
  });
}

export type TeamRow = { id: string; slug: string; name: string };

export async function createTeam(
  request: APIRequestContext,
  name: string,
): Promise<{ status: number; team: TeamRow | null }> {
  const created = await api<{ team?: TeamRow }>(request, "post", "/api/teams", { name });
  return { status: created.status, team: created.body?.team ?? null };
}

export async function inviteToTeam(
  request: APIRequestContext,
  slug: string,
  userId: string,
  role = "Atleta",
) {
  return api<{ invite?: { id: string } }>(request, "post", `/api/teams/${slug}/invites`, {
    userId,
    role,
  });
}

export type EventRow = { id: string; name: string };

/** Evento com datas no futuro, porque o calendário filtra por período. */
export async function createEvent(
  request: APIRequestContext,
  name: string,
  startDate: Date,
): Promise<{ status: number; event: EventRow | null }> {
  const created = await api<{ event?: EventRow }>(request, "post", "/api/events", {
    name,
    location: "Ginásio do E2E",
    startDate: startDate.toISOString(),
    type: "COMPETITION",
  });
  return { status: created.status, event: created.body?.event ?? null };
}

/**
 * Cria um desafio de reautenticação de exclusão direto no banco.
 *
 * A rota normal envia o token por email, e na pilha E2E isso é impossível: o
 * provider `log` registra apenas destinatário e assunto, nunca o corpo, e em
 * produção ele lança exceção porque não há entrega configurada. O envio em si já
 * tem cobertura em `src/lib/__tests__/email.test.ts`.
 *
 * O que este E2E precisa verificar é o que vem depois: a verificação do token, a
 * exigência de reautenticação na exclusão e, principalmente, a cascata. Inserir o
 * desafio direto exercita tudo isso sem depender do email.
 */
export async function createDeletionChallenge(userId: string, tokenVersion: number) {
  const token = randomBytes(32).toString("base64url");
  const challenge = await getDb().accountReauthChallenge.create({
    data: {
      userId,
      purpose: "ACCOUNT_DELETION",
      tokenHash: createHash("sha256").update(token).digest("hex"),
      tokenVersion,
      expiresAt: new Date(Date.now() + REAUTH_TTL_MS),
    },
    select: { id: true },
  });
  return { token, challengeId: challenge.id };
}
