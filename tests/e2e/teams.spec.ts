// Equipes: criação pela interface, convite, aceite pela interface, troca de
// papel, remoção de membro, permissão e exclusão da equipe.
//
// É o fluxo mais longo porque é o que carrega a matriz de permissões de dois
// eixos (função desportiva × função administrativa), que é uma das afirmações
// mais específicas do TCC. O `[memberId]` das rotas de membro é o id do
// teamMember, não o do usuário, então os testes o buscam pela lista de membros.

import { test, expect, authenticate } from "./fixtures/auth";
import { api, createTeam, inviteToTeam } from "./fixtures/api";

async function memberIdOf(request: Parameters<typeof api>[0], slug: string, userId: string) {
  const listed = await api<{ members: { id: string; userId: string }[] }>(
    request,
    "get",
    `/api/teams/${slug}/members`,
  );
  if (listed.status !== 200) throw new Error(`lista de membros respondeu ${listed.status}`);
  const found = listed.body.members.find((m) => m.userId === userId);
  if (!found) throw new Error(`usuário ${userId} não está na lista de membros`);
  return found.id;
}

test.describe("equipes", () => {
  test("cria equipe pela interface e ela aparece na lista", async ({ page, actor }) => {
    const owner = await actor.create("owner");
    await authenticate(page, owner);
    await page.goto("/teams");

    const name = `Equipe E2E ${Date.now()}`;
    await page.getByRole("button", { name: /criar equipe/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Ex: Sharks Allstars").fill(name);
    // A descrição é obrigatória no formulário; sem ela o botão não submete.
    await dialog.getByPlaceholder("Sobre a equipe...").fill("Equipe criada pelo teste E2E.");
    await dialog.getByRole("button", { name: /^criar equipe$/i }).click();

    // O dialog fechar é o primeiro sinal; a equipe criada só entra na lista
    // depois de alternar para "Meus Times", porque a página abre em Sugestões.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: /meus times/i }).click();
    await expect(page.getByText(name).first()).toBeVisible();

    // Filtra por nome em vez de varrer a lista: a rota pagina e ordena por nome,
    // então numa base com outras equipes a nova pode cair fora da primeira página.
    const listed = await api<{ teams: { name: string }[] }>(
      page.request,
      "get",
      `/api/teams?q=${encodeURIComponent(name)}`,
    );
    expect(listed.status).toBe(200);
    expect(listed.body.teams.some((t) => t.name === name)).toBe(true);
  });

  test("convite é aceito pela interface e vira membro", async ({ page, actor }) => {
    const owner = await actor.create("dono");
    const guest = await actor.create("convidado");
    await authenticate(page, owner);

    const created = await createTeam(page.request, `Equipe Convite ${Date.now()}`);
    expect(created.status).toBe(201);
    const slug = created.team!.slug;

    const invited = await inviteToTeam(page.request, slug, guest.id, "Atalai");
    expect(invited.status).toBe(201);

    await authenticate(page, guest);
    await page.goto("/teams/invites");
    await page.getByRole("button", { name: /^aceitar$/i }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: /confirmar/i }).click();
    await expect(page.getByText(/você entrou em/i).first()).toBeVisible();

    const memberId = await memberIdOf(page.request, slug, guest.id);
    expect(memberId).toBeTruthy();
  });

  test("troca de função do membro e remove da equipe", async ({ page, actor }) => {
    const owner = await actor.create("lider");
    const guest = await actor.create("membro");
    await authenticate(page, owner);

    const created = await createTeam(page.request, `Equipe Papel ${Date.now()}`);
    const slug = created.team!.slug;
    await inviteToTeam(page.request, slug, guest.id, "Atleta");

    await authenticate(page, guest);
    const accepted = await api<{ invite?: { id: string } }>(
      page.request,
      "post",
      `/api/teams/invites/${(await api<{ invites: { id: string }[] }>(
        page.request,
        "get",
        "/api/teams/invites",
      )).body.invites[0].id}/accept`,
    );
    expect(accepted.status).toBe(200);

    const memberId = await memberIdOf(page.request, slug, guest.id);

    await authenticate(page, owner);
    const promoted = await api(page.request, "patch", `/api/teams/${slug}/members/${memberId}`, {
      canPost: true,
      canManageMembers: true,
    });
    expect(promoted.status).toBe(200);

    const afterPromotion = await api<{ members: { id: string; canManageMembers?: boolean }[] }>(
      page.request,
      "get",
      `/api/teams/${slug}/members`,
    );
    const member = afterPromotion.body.members.find((m) => m.id === memberId);
    expect(member?.canManageMembers).toBe(true);

    const removed = await api(page.request, "delete", `/api/teams/${slug}/members/${memberId}`);
    expect(removed.status).toBe(200);

    const afterRemoval = await api<{ members: { id: string }[] }>(
      page.request,
      "get",
      `/api/teams/${slug}/members`,
    );
    expect(afterRemoval.body.members.some((m) => m.id === memberId)).toBe(false);
  });

  test("membro não edita a equipe nem o dono apaga a partir de convitado", async ({ page, actor }) => {
    const owner = await actor.create("dono2");
    const guest = await actor.create("convidado2");
    await authenticate(page, owner);
    const created = await createTeam(page.request, `Equipe Perm ${Date.now()}`);
    const slug = created.team!.slug;
    const teamName = created.team!.name;
    await inviteToTeam(page.request, slug, guest.id, "Atleta");

    await authenticate(page, guest);
    const invites = await api<{ invites: { id: string }[] }>(page.request, "get", "/api/teams/invites");
    const accepted = await api(
      page.request,
      "post",
      `/api/teams/invites/${invites.body.invites[0].id}/accept`,
    );
    // Sem esta asserção o teste passa pelo motivo errado: uma equipe sem
    // membros também devolve 403 em PATCH e DELETE, então os 403 abaixo
    // provariam apenas que a equipe estava vazia.
    expect(accepted.status).toBe(200);
    expect(await memberIdOf(page.request, slug, guest.id)).toBeTruthy();

    const edit = await api(page.request, "patch", `/api/teams/${slug}`, {
      name: "Nome roubado pela interface",
    });
    expect(edit.status).toBe(403);

    const remove = await api(page.request, "delete", `/api/teams/${slug}`);
    expect(remove.status).toBe(403);

    // E o nome continua o original, provando que nada foi alterado.
    const fetched = await api<{ team: { name: string } }>(page.request, "get", `/api/teams/${slug}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.team.name).toBe(teamName);
  });

  test("dono exclui a própria equipe", async ({ page, actor }) => {
    const owner = await actor.create("dono3");
    await authenticate(page, owner);
    const created = await createTeam(page.request, `Equipe Efemera ${Date.now()}`);
    const slug = created.team!.slug;

    const deleted = await api(page.request, "delete", `/api/teams/${slug}`);
    expect(deleted.status).toBe(200);

    const fetched = await api(page.request, "get", `/api/teams/${slug}`);
    expect(fetched.status).toBe(404);
  });
});
