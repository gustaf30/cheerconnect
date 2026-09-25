import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import process from "node:process";

// Orquestra a LOAD-001 sobre a pilha isolada de docker-compose.load.yml.
// O app roda a partir do Dockerfile do projeto, então o que é medido é o mesmo
// código de produção; o k6 compartilha a rede e alcança o app pelo nome do serviço.

const root = process.cwd();
// Projeto compose próprio: sem isto o `down` compartilharia o nome de projeto
// com o docker-compose.yml e derrubaria os containers de desenvolvimento.
const COMPOSE = ["compose", "--project-name", "cheerconnect-load", "-f", "docker-compose.load.yml"];

const PG_PORT = process.env.LOAD_PG_PORT || "55432";
const APP_URL = process.env.LOAD_APP_URL || `http://localhost:${process.env.LOAD_APP_PORT || 3100}`;
const DEGRADED_URL =
  process.env.LOAD_APP_DEGRADED_URL ||
  `http://localhost:${process.env.LOAD_APP_DEGRADED_PORT || 3101}`;

const DURATION = process.env.LOAD_DURATION || "2m";
const SKEW = process.env.LOAD_SKEW || "45s";
const LOAD_USERS = process.env.LOAD_USERS || "30";
const SKIP_BUILD = process.env.LOAD_SKIP_BUILD === "true";
const SKIP_SSE = process.env.LOAD_SKIP_SSE === "true";
const SKIP_DEGRADED = process.env.LOAD_DEGRADED === "false";

const DB_URL = `postgresql://load:load@localhost:${PG_PORT}/cheerconnect_load`;

let phase = "inicialização";
const children = [];

function docker(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn("docker", [...COMPOSE, ...args], {
      cwd: root,
      // O serviço k6 fica atrás do profile "k6"; `docker compose run` não aceita
      // --profile, então o profile é habilitado por variável de ambiente.
      env: { ...process.env, COMPOSE_PROFILES: "k6", ...(options.env || {}) },
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
      cwd: root,
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

async function waitForHealth(url, timeoutMs = 180000) {
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

/** Liveness durante a execução: o health fica fora do k6 de propósito, porque
 *  com Redis fora o ping leva até 1,5 s e contaminaria o p95 da fase degradada. */
async function pollHealth(url, durationMs, label) {
  const deadline = Date.now() + durationMs;
  let ok = 0;
  let checks = 0;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/health`);
      checks += 1;
      if (response.status === 200) ok += 1;
    } catch {
      checks += 1;
    }
    await delay(1000);
  }
  const rate = checks ? (ok / checks) * 100 : 0;
  console.log(`  liveness [${label}]: ${ok}/${checks} respostas 200 (${rate.toFixed(1)}%)`);
  return rate;
}

async function runK6(targetUrl, extraEnv = {}) {
  const env = {
    LOAD_BASE_URL: targetUrl,
    LOAD_DURATION: DURATION,
    LOAD_AUTH_USERS: "8",
    LOAD_PASSWORD: "123456",
    ...extraEnv,
  };
  const envArgs = Object.entries(env)
    .filter(([key]) => key.startsWith("LOAD_"))
    .flatMap(([key, value]) => ["-e", `${key}=${value}`]);

  return docker(
    [
      "run",
      "--rm",
      ...envArgs,
      "k6",
      "run",
      "--quiet",
      "--no-color",
      "/scripts/main.js",
    ],
    { stdio: "inherit" }
  );
}

async function main() {
  step("Construindo a imagem do projeto (Dockerfile de produção)");
  if (!SKIP_BUILD) {
    const build = await docker(["build", "app", "app-degraded"]);
    if (build !== 0) {
      fail("docker compose build falhou");
      return;
    }
  }

  step("Subindo Postgres e app (migrations rodam no entrypoint do container)");
  const up = await docker(["up", "-d", "--wait", "postgres", "app"]);
  if (up !== 0) {
    fail("docker compose up falhou");
    return;
  }

  if (!(await waitForHealth(APP_URL))) {
    fail("o app não ficou saudável a tempo");
    return;
  }

  step(`Populando a base de carga (${LOAD_USERS} usuários)`);
  const seed = await node([path.join("scripts", "load-seed.mjs")], {
    env: { DATABASE_URL: DB_URL, LOAD_USERS },
  });
  if (seed !== 0) {
    fail("seed de carga falhou");
    return;
  }

  step("Cenário principal: leitura + autenticação + mutações");
  const healthWatch = pollHealth(APP_URL, 150000, "principal");
  const main = await runK6("http://app:3000");
  await healthWatch;
  if (main !== 0) fail("cenário principal ficou fora dos limiares");

  if (!SKIP_SSE) {
    step("Soak de SSE");
    const soak = await node([path.join("scripts", "sse-soak.mjs")], {
      env: { LOAD_BASE_URL: APP_URL },
    });
    if (soak !== 0) fail("soak de SSE falhou");
  }

  if (!SKIP_DEGRADED) {
    step("Resiliência: com o Redis inalcançável");
    const degradedUp = await docker(["up", "-d", "--wait", "app-degraded"]);
    if (degradedUp !== 0) {
      fail("não foi possível subir o app degradado");
    } else if (!(await waitForHealth(DEGRADED_URL))) {
      fail("o app degradado não ficou saudável");
    } else {
      const watch = pollHealth(DEGRADED_URL, 90000, "degradado");
      const degraded = await runK6("http://app-degraded:3000", {
        LOAD_READ_ONLY: "true",
        LOAD_DURATION: SKEW,
      });
      await watch;
      if (degraded !== 0) {
        fail("a carga sem Redis não manteve os limiares");
      } else {
        console.log("  os limiares se mantiveram com o Redis fora");
      }
    }
  }

  console.log("\n=== Fim da execucao ===");
  console.log(process.exitCode ? "Resultado: FALHA" : "Resultado: OK");
}

async function cleanup() {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
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
