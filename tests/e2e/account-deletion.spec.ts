// Exclusão de conta e a cascata que a LGPD exige.
//
// Este é o teste que fecha a afirmação mais forte de privacidade do trabalho:
// "exclusão efetiva em cascata". Nenhuma outra camada verifica que as linhas
// realmente somem do banco — o teste unitário prova a chamada, o teste de
// integração de banco prova a policy, e nenhum dos dois prova a cadeia inteira
// pela aplicação.
//
// A exclusão exige reautenticação. O envio do token por email não é coberto
// aqui: o provider `log` registra apenas destinatário e assunto, nunca o corpo,
// e em produção ele lança exceção por não haver entrega configurada. O envio tem
// cobertura em src/lib/__tests__/email.test.ts. O que este arquivo verifica é o
// que vem depois do email: a validação do token e a cascata.

import { test, expect, authenticate, loginStatus } from "./fixtures/auth";
import { getDb } from "./fixtures/auth";
import { api, createDeletionChallenge, createPost, createTeam, inviteToTeam, requestConnection, acceptConnectionFrom, createEvent, createConversation, sendMessage } from "./fixtures/api";

/**
 * Contém a cadeia de verificação do token pela URL de destino.
 *
 * A rota GET /verify redireciona para /settings com reauthChallengeId na query,
 * então o id chega sem precisar de e-mail nem de cookie.
 */
async function verifyReauth(page: Parameters<typeof authenticate>[0], token: string) {
  const response = await page.request.get(
    `/api/users/me/reauthenticate/verify?token=${encodeURIComponent(token)}`,
    { maxRedirects: 0 },
  );
  expect(response.status()).toBe(307);
  const location = response.headers().location ?? "";
  const challengeId = new URL(location, "http://localhost:3102").searchParams.get("reauthChallengeId");
  expect(challengeId, `sem reauthChallengeId no redirect ${location}`).toBeTruthy();
  return challengeId!;
}

test.describe("exclusão de conta", () => {
  test("exclui a conta e leva junto post, comentário, conexão, conversa, equipe e evento", async ({
    page,
    actor,
  }) => {
    const owner = await actor.create("excluido");
    const other = await actor.create("sobrevivente");
    const db = getDb();

    // Monta o estado completo: o que o usuário tem e o que ele tem em comum.
    await authenticate(page, owner);
    const post = await createPost(page.request, `post do excluído ${Date.now()}`);
    const postId = post.post!.id;
    const comment = await api<{ comment: { id: string } }>(
      page.request,
      "post",
      `/api/posts/${postId}/comments`,
      { content: `comentário do excluído ${Date.now()}` },
    );
    expect(comment.status).toBe(201);

    const team = await createTeam(page.request, `Equipe do excluído ${Date.now()}`);
    expect(team.status).toBe(201);
    const slug = team.team!.slug;
    await inviteToTeam(page.request, slug, other.id, "Atleta");

    // A conta não pode ser excluída sendo a única administradora da equipe. O
    // convite é aceito e o outro membro promovido, que é a saída que a própria
    // rota sugere no erro.
    await authenticate(page, other);
    const invites = await api<{ invites: { id: string }[] }>(page.request, "get", "/api/teams/invites");
    expect(
      (await api(page.request, "post", `/api/teams/invites/${invites.body.invites[0].id}/accept`)).status,
    ).toBe(200);

    const members = await api<{ members: { id: string; userId: string }[] }>(
      page.request,
      "get",
      `/api/teams/${slug}/members`,
    );
    const otherMember = members.body.members.find((m) => m.userId === other.id)!;

    await authenticate(page, owner);
    expect(
      (await api(page.request, "patch", `/api/teams/${slug}/members/${otherMember.id}`, {
        isAdmin: true,
      })).status,
    ).toBe(200);

    const event = await createEvent(page.request, `Evento do excluído ${Date.now()}`, new Date(Date.now() + 86400000));
    expect(event.status).toBe(201);

    const connection = await requestConnection(page.request, other.id);
    expect(connection.status).toBe(201);
    await authenticate(page, other);
    await acceptConnectionFrom(page.request, owner.id);

    // A conversa é criada pelo dono da conta, depois do aceite. Com a sessão de
    // `other` ainda aberta, o pedido seria uma conversa consigo mesmo e a rota
    // recusaria com 403.
    await authenticate(page, owner);
    const conversation = await createConversation(page.request, other.id);
    expect(conversation.status).toBe(201);
    const conversationId = conversation.conversationId!;
    expect((await sendMessage(page.request, conversationId, `mensagem do excluído ${Date.now()}`)).status).toBe(201);

    // Antes de excluir, tudo existe. Sem isto um "zero" adiante não provaria nada.
    const before = {
      posts: await db.post.count({ where: { authorId: owner.id } }),
      comments: await db.comment.count({ where: { authorId: owner.id } }),
      messages: await db.message.count({ where: { senderId: owner.id } }),
      events: await db.event.count({ where: { creatorId: owner.id } }),
      teamMembers: await db.teamMember.count({ where: { userId: owner.id } }),
      teams: await db.team.count({ where: { id: team.team!.id } }),
      conversations: await db.conversation.count({
        where: { OR: [{ participant1Id: owner.id }, { participant2Id: owner.id }] },
      }),
      connections: await db.connection.count({
        where: { OR: [{ senderId: owner.id }, { receiverId: owner.id }] },
      }),
    };
    expect(before).toEqual({
      posts: 1,
      comments: 1,
      messages: 1,
      events: 1,
      teamMembers: 1,
      teams: 1,
      conversations: 1,
      connections: 1,
    });

    // Reautenticação: cria o desafio, valida o token e usa o id devolvido.
    const tokenVersion = await db.user.findUniqueOrThrow({
      where: { id: owner.id },
      select: { tokenVersion: true },
    }).then((u) => u.tokenVersion);

    const { token } = await createDeletionChallenge(owner.id, tokenVersion);
    await authenticate(page, owner);
    const challengeId = await verifyReauth(page, token);

    const deleted = await api(page.request, "delete", "/api/users/me", {
      username: owner.username,
      reauthChallengeId: challengeId,
    });
    expect(deleted.status).toBe(200);

    // Cascata: o conteúdo de autoria do usuário vai junto. São 39 relações
    // `onDelete: Cascade` no schema, e estas são as que o usuário gera.
    const after = {
      user: await db.user.count({ where: { id: owner.id } }),
      posts: await db.post.count({ where: { authorId: owner.id } }),
      comments: await db.comment.count({ where: { authorId: owner.id } }),
      messages: await db.message.count({ where: { senderId: owner.id } }),
      teamMembers: await db.teamMember.count({ where: { userId: owner.id } }),
      conversations: await db.conversation.count({
        where: { OR: [{ participant1Id: owner.id }, { participant2Id: owner.id }] },
      }),
      connections: await db.connection.count({
        where: { OR: [{ senderId: owner.id }, { receiverId: owner.id }] },
      }),
      challenges: await db.accountReauthChallenge.count({ where: { userId: owner.id } }),
    };
    expect(after).toEqual({
      user: 0,
      posts: 0,
      comments: 0,
      messages: 0,
      teamMembers: 0,
      conversations: 0,
      connections: 0,
      challenges: 0,
    });

    // O que NÃO vai junto é tão importante quanto o que vai. São 8 relações
    // `onDelete: SetNull`: a linha sobrevive e perde a referência ao usuário.
    // Evento e equipe são desse grupo — o calendário da comunidade e a equipe em
    // si não podem sumir porque uma conta foi apagada.
    const survivingEvent = await db.event.findUnique({
      where: { id: event.event!.id },
      select: { id: true, name: true, creatorId: true },
    });
    expect(survivingEvent).not.toBeNull();
    expect(survivingEvent!.creatorId).toBeNull();

    // A equipe sobrevive sem a conta apagada, mas perde o membro que era o dono:
    // sobrou quem foi promovido a administrador. Team não tem relação direta com
    // User — a propriedade vem por TeamMember, que é Cascade.
    const survivingTeam = await db.team.findUnique({
      where: { id: team.team!.id },
      select: { id: true, name: true, _count: { select: { members: true } } },
    });
    expect(survivingTeam).not.toBeNull();
    expect(survivingTeam!._count.members).toBe(1);

    const remaining = await db.teamMember.findMany({
      where: { teamId: team.team!.id },
      select: { userId: true },
    });
    expect(remaining.map((m) => m.userId)).toEqual([other.id]);
  });

  test("login é recusado depois da exclusão", async ({ page, actor, request }) => {
    const owner = await actor.create("some");

    await authenticate(page, owner);
    const db = getDb();
    const tokenVersion = await db.user
      .findUniqueOrThrow({ where: { id: owner.id }, select: { tokenVersion: true } })
      .then((u) => u.tokenVersion);
    const { token } = await createDeletionChallenge(owner.id, tokenVersion);
    const challengeId = await verifyReauth(page, token);
    expect(
      (await api(page.request, "delete", "/api/users/me", {
        username: owner.username,
        reauthChallengeId: challengeId,
      })).status,
    ).toBe(200);

    // Sessão nova, com um contexto de requisição isolado. Reusar o do `page`
    // manteria o cookie da conta apagada e a checagem não provaria nada.
    expect(await loginStatus(request, owner)).toBe(401);
  });

  test("conta de administrador único da equipe não pode ser excluída", async ({ page, actor }) => {
    const owner = await actor.create("unico_admin");
    await authenticate(page, owner);
    const created = await createTeam(page.request, `Equipe Sem Herdeiro ${Date.now()}`);
    expect(created.status).toBe(201);

    const db = getDb();
    const tokenVersion = await db.user
      .findUniqueOrThrow({ where: { id: owner.id }, select: { tokenVersion: true } })
      .then((u) => u.tokenVersion);
    const { token } = await createDeletionChallenge(owner.id, tokenVersion);
    const challengeId = await verifyReauth(page, token);

    // A regra protege a equipe de ficar sem ninguém capaz de administrá-la.
    const blocked = await api<{ error: string; teams: { name: string }[] }>(
      page.request,
      "delete",
      "/api/users/me",
      { username: owner.username, reauthChallengeId: challengeId },
    );
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatch(/administrador/i);
    expect(blocked.body.teams.some((t) => t.name === created.team!.name)).toBe(true);

    // A conta e a equipe continuam no lugar depois da recusa.
    expect(await db.user.count({ where: { id: owner.id } })).toBe(1);
    expect(await db.team.count({ where: { id: created.team!.id } })).toBe(1);
  });

  test("exclusão sem reautenticação é recusada", async ({ page, actor }) => {
    const owner = await actor.create("semreauth");
    await authenticate(page, owner);

    const semChallenge = await api(page.request, "delete", "/api/users/me", {
      username: owner.username,
    });
    expect([400, 403]).toContain(semChallenge.status);

    const db = getDb();
    expect(await db.user.count({ where: { id: owner.id } })).toBe(1);
  });

  test("username errado na confirmação é recusado", async ({ page, actor }) => {
    const owner = await actor.create("errado");
    await authenticate(page, owner);
    const db = getDb();
    const tokenVersion = await db.user
      .findUniqueOrThrow({ where: { id: owner.id }, select: { tokenVersion: true } })
      .then((u) => u.tokenVersion);
    const { token } = await createDeletionChallenge(owner.id, tokenVersion);
    const challengeId = await verifyReauth(page, token);

    const wrong = await api(page.request, "delete", "/api/users/me", {
      username: "nao-e-o-username",
      reauthChallengeId: challengeId,
    });
    expect([400, 403]).toContain(wrong.status);
    expect(await db.user.count({ where: { id: owner.id } })).toBe(1);
  });
});
