// Eventos: criação, filtro do calendário, edição, exclusão e permissão.
//
// O calendário é dirigido pela interface, porque é a tela que o orientador e o
// usuário veem. A edição e a exclusão vão por API, já que a página de detalhe
// expõe as duas ações.

import { test, expect, authenticate } from "./fixtures/auth";
import { api, createEvent } from "./fixtures/api";

/** Instante no futuro, porque o calendário abre em eventos por vir. */
function futureIn(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

test.describe("eventos", () => {
  test("evento criado aparece no calendário", async ({ page, actor }) => {
    const organizer = await actor.create("organizador");
    await authenticate(page, organizer);

    const name = `Evento E2E ${Date.now()}`;
    const created = await createEvent(page.request, name, futureIn(20));
    expect(created.status).toBe(201);

    await page.goto("/events");
    await expect(page.getByText(name).first()).toBeVisible();

    // Filtra por nome em vez de varrer a lista: a rota pagina e ordena por data,
    // então numa base com outros eventos o nome novo pode ficar fora da primeira
    // página — que é como este teste falhava de forma intermitente.
    const listed = await api<{ events: { name: string }[] }>(
      page.request,
      "get",
      `/api/events?q=${encodeURIComponent(name)}`,
    );
    expect(listed.status).toBe(200);
    expect(listed.body.events.some((e) => e.name === name)).toBe(true);
  });

  test("filtro por tipo separa competições de outros eventos", async ({ page, actor }) => {
    const organizer = await actor.create("filtro");
    await authenticate(page, organizer);

    const stamp = Date.now();
    const competition = `Competicao ${stamp}`;
    const camp = `Camp ${stamp}`;
    expect((await createEvent(page.request, competition, futureIn(21))).status).toBe(201);

    // Um evento de outro tipo, para o filtro ter o que separar.
    const other = await api<{ event?: { id: string } }>(page.request, "post", "/api/events", {
      name: camp,
      location: "Ginasio do E2E",
      startDate: futureIn(22).toISOString(),
      type: "CAMP",
    });
    expect(other.status).toBe(201);

    const byType = await api<{ events: { name: string; type: string }[] }>(
      page.request,
      "get",
      "/api/events?type=COMPETITION",
    );
    expect(byType.status).toBe(200);
    expect(byType.body.events.some((e) => e.name === competition)).toBe(true);
    expect(byType.body.events.some((e) => e.name === camp)).toBe(false);
  });

  test("edita e exclui o próprio evento", async ({ page, actor }) => {
    const organizer = await actor.create("editor_evento");
    await authenticate(page, organizer);

    const name = `Evento Editavel ${Date.now()}`;
    const created = await createEvent(page.request, name, futureIn(23));
    expect(created.status).toBe(201);
    const eventId = created.event!.id;

    const renamed = `Evento Renomeado ${Date.now()}`;
    const patched = await api<{ event?: { name: string } }>(
      page.request,
      "patch",
      `/api/events/${eventId}`,
      { name: renamed },
    );
    expect(patched.status).toBe(200);

    const fetched = await api<{ event: { name: string } }>(page.request, "get", `/api/events/${eventId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.event.name).toBe(renamed);

    const deleted = await api(page.request, "delete", `/api/events/${eventId}`);
    expect(deleted.status).toBe(200);

    const gone = await api(page.request, "get", `/api/events/${eventId}`);
    expect(gone.status).toBe(404);
  });

  test("terceiro não edita nem exclui evento de outro", async ({ page, actor }) => {
    const organizer = await actor.create("dono_evento");
    const stranger = await actor.create("intruso");
    await authenticate(page, organizer);
    const name = `Evento Protegido ${Date.now()}`;
    const created = await createEvent(page.request, name, futureIn(24));
    const eventId = created.event!.id;

    await authenticate(page, stranger);
    const edit = await api(page.request, "patch", `/api/events/${eventId}`, { name: "invadido" });
    expect(edit.status).toBe(403);

    const remove = await api(page.request, "delete", `/api/events/${eventId}`);
    expect(remove.status).toBe(403);

    // O evento do dono continua intacto depois das duas tentativas.
    const fetched = await api<{ event: { name: string } }>(page.request, "get", `/api/events/${eventId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.event.name).toBe(name);
  });
});
