// Orquestra o E2E sobre a pilha isolada de docker-compose.e2e.yml.
//
// Existe pelo mesmo motivo do load-test.mjs: o E2E é destrutivo e o servidor que
// o playwright.config.ts sobe (`npm run dev`) herda o DATABASE_URL do `.env`,
// que é o banco de PRODUÇÃO. Este script garante que os testes rodem contra a
// pilha isolada e que ela seja derrubada no fim, inclusive em caso de Ctrl-C.
//
//   npm run test:e2e        sobe, roda e derruba
//   npm run test:e2e:only   só o playwright, assumindo a pilha já no ar

import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import process from "node:process";

// Projeto compose próprio: sem isto o `down` compartilharia nome com o
// docker-compose.yml e derrubaria os containers de desenvolvimento.
const COMPOSE = ["compose", "--project-name", "cheerconnect-e2e", "-f", "docker-compose.e2e.yml"];

const PG_PORT = process.env.E2E_PG_PORT || "55433";
const APP_PORT = process.env.E2E_APP_PORT || "3102";
const APP_URL = process.env.E2E_BASE_URL || `http://localhost:${APP_PORT}`;
const DB_URL = `postgresql://e2e:e2e@localhost:${PG_PORT}/cheerconnect_e2e`;

const SKIP_BUILD = process.env.E2E_SKIP_BUILD === "true";
const KEEP_UP = process.env.E2E_KEEP_UP === "true";
const PLAYWRIGHT_ARGS = (process.env.E2E_ARGS || "").split(" ").filter(Boolean);

let phase = "inicialização";
const children = [];

function docker(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn("docker", [...COMPOSE, ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: options.stdio || "inherit",
      shell: false,
    });
    if (options.track !== false) children.push(child);
    child.once("error", () => resolve(1));
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

function node(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: path.resolve(import.meta.dirname, ".."),
      env: { ...process.env, ...(options.env || {}) },
      stdio: options.stdio || "inherit",
      shell: false,
    });
    children.push(child);
    child.once("error", () => resolve(1));
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

function step(name) {
  phase = name;
  console.log(`\n=== ${name} ===`);
}

function fail(message) {
  console.error(`\nFALHA em "${phase}": ${message}`);
  process.exitCode = 1;
}

async function waitForHealth(url, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.status === 200) {
        const body = await response.json();
        if (body.database === "ok") {
          console.log(`  app pronto (redis: ${body.redis})`);
          return true;
        }
      }
    } catch {
      // ainda subindo
    }
    await delay(2000);
  }
  return false;
}

/**
 * Aquece as rotas antes de entregar ao Playwright.
 *
 * `waitForHealth` só prova que o processo responde, e a primeira requisição a
 * cada rota paga custo de imagem em disco, cache do Postgres e renderização
 * inicial. Sem este passo, o primeiro teste que abre `/feed` pode estourar o
 * timeout de 30 s numa execução limpa e passar na seguinte — a suíte ficava
 * instável dependendo de se o contêiner já estava no ar. É a mesma lição do
 * aquecimento na LOAD-001: a medição começa depois do aquecimento, não durante.
 */
async function warmRoutes() {
  const paths = ["/", "/login", "/register", "/feed", "/events", "/connections", "/messages", "/teams"];
  const started = Date.now();
  let slowest = { path: "", ms: 0 };
  for (const path of paths) {
    const t0 = Date.now();
    try {
      // 307 para /login é a resposta esperada de rota protegida sem sessão.
      await fetch(`${APP_URL}${path}`, { redirect: "manual" });
    } catch {
      // Falha aqui não é bloqueante: o teste que precisa da rota vai falhar com
      // mensagem própria, que é mais útil do que abortar a execução inteira.
    }
    const ms = Date.now() - t0;
    if (ms > slowest.ms) slowest = { path, ms };
  }
  console.log(
    `  rotas aquecidas em ${((Date.now() - started) / 1000).toFixed(1)}s ` +
      `(mais lenta: ${slowest.path} em ${slowest.ms}ms)`,
  );
}

async function main() {
  step("Construindo a imagem de produção");
  if (!SKIP_BUILD) {
    const build = await docker(["build", "app"]);
    if (build !== 0) {
      fail("docker compose build falhou");
      return;
    }
  }

  step("Subindo Postgres e app (as migrations rodam no entrypoint do container)");
  const up = await docker(["up", "-d", "--wait", "postgres", "app"]);
  if (up !== 0) {
      fail("docker compose up falhou");
      return;
    }

  if (!(await waitForHealth(APP_URL))) {
    fail("o app não ficou saudável a tempo");
    return;
  }

  await warmRoutes();


  step(`Playwright contra ${APP_URL}`);
  // cli.js do @playwright/test é o mesmo alvo do bin `playwright`, mas invocado
  // pelo node: o shell:false abaixo não resolve os .cmd do Windows.
  const run = await node(
    [path.join("node_modules", "@playwright", "test", "cli.js"), "test", ...PLAYWRIGHT_ARGS],
    {
      env: {
        // O config só desliga o webServer quando E2E_BASE_URL está definido, então
        // é ele que impede o `npm run dev` de subir e apontar para produção.
        E2E_BASE_URL: APP_URL,
        // Os specs importam Prisma para afirmar a cascata no banco; sem isto eles
        // apontariam para o `.env`, que é produção.
        DATABASE_URL: DB_URL,
      },
    },
  );
  if (run !== 0) fail("houve teste E2E falhas");

  console.log(
    run === 0
      ? "\n=== E2E: OK ==="
      : "\n=== E2E: FALHOU ===",
  );
}

async function cleanup() {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
  if (KEEP_UP) {
    console.log("\npilha mantida no ar (E2E_KEEP_UP=true)");
    return;
  }
  await docker(["down", "-v"], { stdio: "ignore" });
}

process.on("SIGINT", async () => {
  await cleanup();
  process.exit(130);
});

main()
  .catch((error) => fail(error?.message ?? String(error)))
  .finally(cleanup);
