// Mensagens: criação da conversa, envio pela interface, leitura pelo outro lado,
// marcação de lida e exclusão.
//
// O envio é dirigido pelo browser. A leitura pelo outro lado é conferida pela
// API, porque o que importa é que a mensagem chegue a quem recebe.
//
// Todas as conversas exigem conexão aceita: `POST /api/conversations` responde
// 403 para quem não tem conexão com o destinatário. É privacidade por desenho, e
// o primeiro teste daqui fixa esse comportamento.

import { test, expect, authenticate } from "./fixtures/auth";
import { api, connectPair, createConversation, sendMessage } from "./fixtures/api";

test.describe("mensagens", () => {
  test("conversa com quem não é conexão é recusada", async ({ page, actor }) => {
    const stranger = await actor.create("desconhecido");
    const other = await actor.create("qualquer");
    await authenticate(page, stranger);

    const attempt = await createConversation(page.request, other.id);
    expect(attempt.status).toBe(403);
    expect(attempt.conversationId).toBeNull();
  });

  test("envia mensagem pela interface e o destinatário recebe", async ({ page, actor }) => {
    const sender = await actor.create("remetente");
    const receiver = await actor.create("destino");
    await connectPair(page, sender, receiver);

    const created = await createConversation(page.request, receiver.id);
    expect(created.status).toBe(201);
    const conversationId = created.conversationId!;

    await page.goto(`/messages/${conversationId}`);
    const content = `mensagem de e2e ${Date.now()}`;
    await page.getByRole("textbox", { name: "Mensagem" }).fill(content);
    await page.getByRole("button", { name: "Enviar mensagem" }).click();

    // Sinal de conclusão: o campo esvazia depois do envio. Consultar a API antes
    // disso corre contra o POST e falha por corrida.
    await expect(page.getByRole("textbox", { name: "Mensagem" })).toHaveValue("");
    await expect(page.getByText(content)).toBeVisible();

    await authenticate(page, receiver);
    const list = await api<{ conversations: { id: string }[] }>(
      page.request,
      "get",
      "/api/conversations",
    );
    expect(list.status).toBe(200);
    expect(list.body.conversations.some((c) => c.id === conversationId)).toBe(true);

    const messages = await api<{ messages: { content: string }[] }>(
      page.request,
      "get",
      `/api/conversations/${conversationId}/messages`,
    );
    expect(messages.status).toBe(200);
    expect(messages.body.messages.some((m) => m.content === content)).toBe(true);
  });

  test("marcar como lida zera as não lidas do destinatário", async ({ page, actor }) => {
    const sender = await actor.create("comum");
    const receiver = await actor.create("leitor");
    await connectPair(page, sender, receiver);

    const conversation = await createConversation(page.request, receiver.id);
    const conversationId = conversation.conversationId!;
    await sendMessage(page.request, conversationId, `primeira ${Date.now()}`);
    await sendMessage(page.request, conversationId, `segunda ${Date.now()}`);

    await authenticate(page, receiver);
    const before = await api<{ conversations: { id: string; unreadCount: number }[] }>(
      page.request,
      "get",
      "/api/conversations",
    );
    expect(before.status).toBe(200);
    const pending = before.body.conversations.find((c) => c.id === conversationId);
    expect(pending?.unreadCount).toBe(2);

    const marked = await api(
      page.request,
      "post",
      `/api/conversations/${conversationId}/messages/read`,
    );
    expect(marked.status).toBe(200);

    const after = await api<{ conversations: { id: string; unreadCount: number }[] }>(
      page.request,
      "get",
      "/api/conversations",
    );
    const target = after.body.conversations.find((c) => c.id === conversationId);
    expect(target?.unreadCount).toBe(0);
  });

  test("excluir a conversa tira ela dos dois lados", async ({ page, actor }) => {
    const sender = await actor.create("dono");
    const other = await actor.create("parceiro");
    await connectPair(page, sender, other);

    const conversation = await createConversation(page.request, other.id);
    const conversationId = conversation.conversationId!;
    await sendMessage(page.request, conversationId, `antes de apagar ${Date.now()}`);

    const deleted = await api(page.request, "delete", `/api/conversations/${conversationId}`);
    expect(deleted.status).toBe(200);

    for (const who of [sender, other]) {
      await authenticate(page, who);
      const list = await api<{ conversations: { id: string }[] }>(
        page.request,
        "get",
        "/api/conversations",
      );
      expect(list.body.conversations.some((c) => c.id === conversationId)).toBe(false);
    }
  });

  test("terceiro não lê conversa de que não participa", async ({ page, actor }) => {
    const first = await actor.create("um");
    const second = await actor.create("dois");
    const outsider = await actor.create("fora");
    await connectPair(page, first, second);

    const conversation = await createConversation(page.request, second.id);
    const conversationId = conversation.conversationId!;
    await sendMessage(page.request, conversationId, `privada ${Date.now()}`);

    await authenticate(page, outsider);
    const attempt = await api(page.request, "get", `/api/conversations/${conversationId}/messages`);
    // 404, e não 403: a rota usa getConversationWithAccessCheck, que trata
    // "não existe" e "não é seu" com o mesmo status, para não revelar a
    // existência da conversa. Aceitar os dois tornaria o teste cego a uma
    // regressão de contrato.
    expect(attempt.status).toBe(404);
  });
});
