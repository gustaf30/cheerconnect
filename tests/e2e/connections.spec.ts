// Conexões: solicitação, aceite pela interface, recusa, efeito no feed de quem
// se segue e remoção.
//
// O aceite é dirigido pelo browser, que é o caminho do usuário. O restante vai
// por API, para montar o estado inicial e afirmar o efeito sem depender de
// reRenderização da tela.
//
// Dois detalhes de contrato moldam os testes e valem registro:
//  - DELETE /api/connections/[id] e POST /api/connections/[id]/accept recebem o
//    id da PESSOA do outro lado, não o da conexão. Passar o id da conexão dá 404.
//  - os botões de aceitar e recusar só existem na aba de pedidos recebidos; a
//    aba padrão é a de conexões já estabelecidas.

import { test, expect, authenticate } from "./fixtures/auth";
import { api, createPost, requestConnection, acceptConnectionFrom } from "./fixtures/api";

test.describe("conexões", () => {
  test("solicitação chega como pendente e o aceite é feito pela interface", async ({
    page,
    actor,
  }) => {
    const sender = await actor.create("solicitante");
    const receiver = await actor.create("destinatario");
    await authenticate(page, sender);

    const requested = await requestConnection(page.request, receiver.id);
    expect(requested.status).toBe(201);
    expect(requested.connection!.status).toBe("PENDING");

    await authenticate(page, receiver);
    await page.goto("/connections?tab=received");
    await page.getByRole("button", { name: "Aceitar conexão" }).first().click();
    await expect(page.getByText(/conexão aceita/i).first()).toBeVisible();

    // Confirma pelo servidor: a tela pode reRenderizar antes de a escrita
    // terminar, e o que importa é o estado aceito. A lista já vem na
    // perspectiva de quem está logado: cada item traz `user` (o outro lado do
    // par) e `isSender`, em vez de sender/receiver aninhados.
    const mine = await api<{
      connections: { status: string; user?: { id: string }; isSender: boolean }[];
    }>(page.request, "get", "/api/connections");
    expect(mine.status).toBe(200);
    const pair = mine.body.connections.filter((c) => c.user?.id === sender.id);
    expect(pair.some((c) => c.status === "ACCEPTED")).toBe(true);
  });

  test("conexão aceita faz o post entrar no feed de quem se segue", async ({ page, actor }) => {
    const follower = await actor.create("seguidor");
    const followed = await actor.create("seguido");

    // Post de quem será seguido.
    await authenticate(page, followed);
    const content = `post de quem se segue ${Date.now()}`;
    expect((await createPost(page.request, content)).post).not.toBeNull();

    // Antes da conexão, o filtro `following` do seguidor não traz esse post.
    await authenticate(page, follower);
    const before = await api<{ posts: { content: string }[] }>(
      page.request,
      "get",
      "/api/posts?filter=following",
    );
    expect(before.status).toBe(200);
    expect(before.body.posts.some((p) => p.content === content)).toBe(false);

    const requested = await requestConnection(page.request, followed.id);
    expect(requested.status).toBe(201);
    await authenticate(page, followed);
    expect((await acceptConnectionFrom(page.request, follower.id)).status).toBe(200);

    // A consulta é do seguidor, não de quem aceitou.
    await authenticate(page, follower);
    const after = await api<{ posts: { content: string }[] }>(
      page.request,
      "get",
      "/api/posts?filter=following",
    );
    expect(after.body.posts.some((p) => p.content === content)).toBe(true);
  });

  test("recusar pedido deixa o par sem conexão", async ({ page, actor }) => {
    const sender = await actor.create("rejeitante");
    const receiver = await actor.create("rejeitado");
    await authenticate(page, sender);
    expect((await requestConnection(page.request, receiver.id)).status).toBe(201);

    // A recusa usa a mesma rota de remoção, com o id de quem fez a solicitação.
    await authenticate(page, receiver);
    const removed = await api(page.request, "delete", `/api/connections/${sender.id}`);
    expect(removed.status).toBe(200);

    // Sem conexão, o post do outro não entra no filtro de quem se segue.
    await authenticate(page, sender);
    const following = await api<{ posts: { authorId: string }[] }>(
      page.request,
      "get",
      "/api/posts?filter=following",
    );
    expect(following.body.posts.some((p) => p.authorId === receiver.id)).toBe(false);
  });

  test("remover conexão tira o post do feed de quem se segue", async ({ page, actor }) => {
    const follower = await actor.create("desfaz");
    const followed = await actor.create("desfollowed");

    // O pedido sai de `follower`: pedir conexão para si mesmo é recusado.
    await authenticate(page, follower);
    expect((await requestConnection(page.request, followed.id)).status).toBe(201);

    await authenticate(page, followed);
    const content = `post temporario ${Date.now()}`;
    await createPost(page.request, content);
    expect((await acceptConnectionFrom(page.request, follower.id)).status).toBe(200);

    await authenticate(page, follower);
    const withConn = await api<{ posts: { content: string }[] }>(
      page.request,
      "get",
      "/api/posts?filter=following",
    );
    expect(withConn.body.posts.some((p) => p.content === content)).toBe(true);

    const removed = await api(page.request, "delete", `/api/connections/${followed.id}`);
    expect(removed.status).toBe(200);

    const withoutConn = await api<{ posts: { content: string }[] }>(
      page.request,
      "get",
      "/api/posts?filter=following",
    );
    expect(withoutConn.body.posts.some((p) => p.content === content)).toBe(false);
  });

  test("segunda solicitação do mesmo par é rejeitada", async ({ page, actor }) => {
    const sender = await actor.create("duplicado");
    const receiver = await actor.create("unico");
    await authenticate(page, sender);

    expect((await requestConnection(page.request, receiver.id)).status).toBe(201);
    const second = await requestConnection(page.request, receiver.id);
    expect(second.status).toBe(400);
  });
});
