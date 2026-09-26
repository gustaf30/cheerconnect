// Publicação: criação, edição, comentário, curtida e exclusão.
//
// A criação e a curtida são dirigidas pelo browser, que é o caminho que o usuário
// percorre. Edição e exclusão vão por API porque a interface não as expõe: as
// rotas PUT e DELETE de /api/posts/[id] existem e nenhum componente as chama, o
// que é uma lacuna de produto e não de teste.

import { test, expect, authenticate } from "./fixtures/auth";
import { api, createPost } from "./fixtures/api";

test.describe("publicação", () => {
  test("cria post pela interface e ele aparece no próprio feed", async ({ page, actor }) => {
    const author = await actor.create("autor");
    await authenticate(page, author);
    await page.goto("/feed");

    const content = `post de e2e ${Date.now()}`;
    const composer = page.getByLabel(/conteúdo da publicação/i).first();
    await composer.fill(content);
    await page.getByRole("button", { name: /^publicar$/i }).first().click();

    // O campo esvaziar é o sinal de que o envio terminou. Sem esperar por ele, a
    // consulta ao servidor abaixo corre antes do POST e falha por corrida: o
    // texto preenchido ainda está no campo, então uma busca por ele na tela
    // passa sem que o post exista.
    await expect(composer).toHaveValue("");
    await expect(page.getByText(content)).toBeVisible();

    const listed = await api<{ posts: { id: string; content: string }[] }>(
      page.request,
      "get",
      "/api/posts?filter=all",
    );
    expect(listed.status).toBe(200);
    expect(listed.body.posts.some((post) => post.content === content)).toBe(true);
  });

  test("edita o conteúdo do próprio post", async ({ page, actor }) => {
    const author = await actor.create("editor");
    await authenticate(page, author);

    const created = await createPost(page.request, `conteudo original ${Date.now()}`);
    expect(created.status).toBe(200);
    const postId = created.post!.id;

    const updated = await api(page.request, "put", `/api/posts/${postId}`, {
      content: `conteudo revisado ${Date.now()}`,
    });
    expect(updated.status).toBe(200);

    const fetched = await api<{ post: { content: string } }>(page.request, "get", `/api/posts/${postId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.post.content).toContain("conteudo revisado");
  });

  test("comenta em post de terceiro", async ({ page, actor }) => {
    const author = await actor.create("postauthor");
    const reader = await actor.create("comentarista");
    await authenticate(page, author);

    const created = await createPost(page.request, `post para comentar ${Date.now()}`);
    const postId = created.post!.id;

    await authenticate(page, reader);
    const comment = `comentario de e2e ${Date.now()}`;
    const response = await api<{ comment: { id: string } }>(
      page.request,
      "post",
      `/api/posts/${postId}/comments`,
      { content: comment },
    );
    expect(response.status).toBe(201);

    const listed = await api<{ comments: { content: string }[] }>(
      page.request,
      "get",
      `/api/posts/${postId}/comments`,
    );
    expect(listed.status).toBe(200);
    expect(listed.body.comments.some((item) => item.content === comment)).toBe(true);
  });

  test("curte e descurte alternando o estado no servidor", async ({ page, actor }) => {
    const author = await actor.create("curtido");
    await authenticate(page, author);
    const created = await createPost(page.request, `post para curtir ${Date.now()}`);
    const postId = created.post!.id;

    // `exact: true` é obrigatório aqui: o nome acessível alterna entre "Curtir" e
    // "Descurtir", e sem âncora o locator de "Curtir" casaria com "Descurtir".
    const liked = async () => {
      const response = await api<{ post: { isLiked: boolean } }>(
        page.request,
        "get",
        `/api/posts/${postId}`,
      );
      expect(response.status).toBe(200);
      return response.body.post.isLiked;
    };

    await page.goto(`/post/${postId}`);
    await expect(page.getByRole("button", { name: "Curtir", exact: true })).toBeVisible();
    expect(await liked()).toBe(false);

    await page.getByRole("button", { name: "Curtir", exact: true }).click();
    // O componente atualiza o estado antes do fetch, então a tela sozinha não
    // prova nada: a confirmação tem de vir do servidor.
    await expect.poll(() => liked()).toBe(true);

    await page.getByRole("button", { name: "Descurtir", exact: true }).click();
    await expect.poll(() => liked()).toBe(false);
  });

  test("exclui o próprio post e ele some", async ({ page, actor }) => {
    const author = await actor.create("exclusor");
    await authenticate(page, author);
    const created = await createPost(page.request, `post a excluir ${Date.now()}`);
    const postId = created.post!.id;

    const deleted = await api(page.request, "delete", `/api/posts/${postId}`);
    expect(deleted.status).toBe(200);

    const fetched = await api(page.request, "get", `/api/posts/${postId}`);
    expect(fetched.status).toBe(404);
  });

  test.describe("autorização cruzada", () => {
    // Edição e exclusão pelo usuário errado. É a verificação que sustenta a
    // afirmação de que a RLS e a checagem de dono protegem a publicação: sem
    // ela, qualquer conta poderia reescrever o post de outra pessoa.
    test("terceiro não edita nem exclui post de outro", async ({ page, actor }) => {
      const author = await actor.create("dono");
      const stranger = await actor.create("estranho");
      await authenticate(page, author);
      const content = `post protegido ${Date.now()}`;
      const created = await createPost(page.request, content);
      const postId = created.post!.id;

      await authenticate(page, stranger);
      const edit = await api(page.request, "put", `/api/posts/${postId}`, { content: "invadido" });
      expect(edit.status).toBe(403);

      const remove = await api(page.request, "delete", `/api/posts/${postId}`);
      expect(remove.status).toBe(403);

      // O post do dono continua intacto depois das duas tentativas.
      const fetched = await api<{ post: { content: string } }>(
        page.request,
        "get",
        `/api/posts/${postId}`,
      );
      expect(fetched.status).toBe(200);
      expect(fetched.body.post.content).toBe(content);
    });
  });
});
