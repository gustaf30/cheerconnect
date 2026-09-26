// Smoke de leitura: identidade do produto, acessibilidade automática, proteção
// de rota e carregamento dos módulos centrais.
//
// Os E2E destrutivos vivem nos demais arquivos deste diretório. Aqui nada é
// criado nem apagado, e por isso os testes rodam em paralelo e sem esperar.

import { test, expect, authenticate, type TestUser, type ActorFactory } from "./fixtures/auth";
import { createEvent, createPost, createConversation, sendMessage } from "./fixtures/api";
import AxeBuilder from "@axe-core/playwright";
import type { AxeResults } from "axe-core";
import type { Page } from "@playwright/test";

/** Conta principal da varredura, montada dentro de cada teste. */
let currentUser: TestUser | undefined;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("landing page exposes the product identity", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Cheer\s*Connect/i }).first()).toBeVisible();
});

test("landing page has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("authentication pages have no automatically detectable accessibility violations", async ({ page }) => {
  for (const path of ["/login", "/register"]) {
    await page.goto(path);
    await page.waitForTimeout(1500);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }
});

test("protected routes redirect unauthenticated users to login", async ({ page }) => {
  await page.goto("/feed");
  await expect(page).toHaveURL(/\/login/);
});

test("registration form communicates password requirements", async ({ page }) => {
  await page.goto("/register");
  const password = page.locator('input[type="password"]').first();
  await password.fill("123");
  await page.getByRole("button", { name: /criar conta/i }).click();
  await expect(page.getByText(/8 caracteres/i).first()).toBeVisible();
});

test.describe("authenticated smoke flows", () => {
  // Antes dependia de E2E_EMAIL e E2E_PASSWORD e era pulado sem eles. Agora o
  // usuário vem da fixture, então a cobertura autenticada não depende de
  // variável de ambiente nem de conta semeada previamente.
  test("login and open core modules", async ({ page, actor }) => {
    const user: TestUser = await actor.create("smoke");
    await authenticate(page, user);
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/feed/);

    for (const path of ["/search", "/events", "/connections", "/messages", "/teams"]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForTimeout(1500);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    }
  });
});

/**
 * Acessibilidade das telas com conteúdo.
 *
 * O smoke acima roda com conta vazia, então os widgets ficam sem itens e o axe
 * não vê quase nada: numa conta nova o calendário não tem badge nenhum. Aqui a
 * conta tem post, evento e conexão, e a varredura roda nos dois temas.
 *
 * O tema escuro era o buraco mais sério: `defaultTheme="light"` no provider
 * significava que nenhuma violação de contraste do tema escuro era detectada —
 * e era justamente lá que as piores estavam.
 */
/** Resumo legível: sem isso o diff é uma lista de ids sem dizer onde. */
function describeViolations(path: string, violations: AxeResults["violations"]) {
  return violations
    .map((v) => {
      // `target` é um array de seletores, possivelmente aninhado em shadow DOM.
      const targets = v.nodes.map((n) => `${n.target.join(" ")} ${n.failureSummary ?? ""}`.trim());
      return `${v.id} (${v.nodes.length}) em ${path}: ${targets.join(" | ")}`;
    })
    .join("\n");
}

const PAGES_WITH_CONTENT = ["/feed", "/events", "/connections", "/messages", "/teams", "/notifications"] as const;

async function seedContent(page: Page, actor: ActorFactory) {
  const author = await actor.create("outro");
  await authenticate(page, author);
  const post = await createPost(page.request, `post para auditar ${Date.now()}`);
  await createEvent(page.request, `Evento para auditar ${Date.now()}`, new Date(Date.now() + 86400000));

  await authenticate(page, currentUser!);
  const conversation = await createConversation(page.request, author.id);
  if (conversation.conversationId) {
    await sendMessage(page.request, conversation.conversationId, `mensagem para auditar ${Date.now()}`);
  }
  return post.post!.id;
}

test.describe("acessibilidade com conteúdo", () => {
  test.use({ colorScheme: "light" });

  test("telas com conteúdo não têm violação no tema claro", async ({ page, actor }) => {
    currentUser = await actor.create("a11y");
    await authenticate(page, currentUser);
    const postId = await seedContent(page, actor);

    for (const path of [...PAGES_WITH_CONTENT, `/post/${postId}`]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).analyze();
      // O relatório nomeia a tela e o elemento: `toEqual([])` numa lista de
      // páginas imprime um diff que não diz qual delas nem o que falhou.
      expect(describeViolations(path, results.violations)).toBe("");
    }
  });

  test("telas com conteúdo não têm violação no tema escuro", async ({ page, actor }) => {
    currentUser = await actor.create("a11y_dark");
    await authenticate(page, currentUser);
    // O tema vive em localStorage sob esta chave (theme-provider.tsx).
    await page.addInitScript(() => {
      window.localStorage.setItem("cheerconnect-theme", "dark");
    });
    const postId = await seedContent(page, actor);

    for (const path of [...PAGES_WITH_CONTENT, `/post/${postId}`]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).analyze();
      expect(describeViolations(`${path} (escuro)`, results.violations)).toBe("");
    }
  });
});
