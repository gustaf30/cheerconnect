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

const DURATION = process.env.LOAD_DURATION || "5m";
const WARMUP = process.env.LOAD_WARMUP || "30s";
const SKEW = process.env.LOAD_SKEW || "45s";
const LOAD_USERS = process.env.LOAD_USERS || "30";
// Medir uma vez e reportar um p95 solitário não se sustenta: a variância entre
// execuções equivalentes já foi medida em ordens de grandeza. A mediana de N
// execuções é o número defensável.
const RUNS = Number(process.env.LOAD_RUNS || 3);
const RUN_ID = process.env.LOAD_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
// A sonda de limite de taxa faz 25 logins em rajada e esgota a janela de
// 15/min por IP. Rodando em toda execucao, o setup da seguinte nao autentica e
// o k6 aborta sem metricas. Ela responde "o limitador bloqueia?", nao "quanto
// tempo leva?", entao uma execucao e suficiente.
const PROBE_ON_LAST = process.env.LOAD_PROBE !== "all";
// Folga entre execucoes para a janela deslizante de login drenar.
const COOLDOWN = Number(process.env.LOAD_COOLDOWN || 70);
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

/** Converte "30s" / "5m" / "1m30s" em segundos, para dimensionar o polling. */
function parseDuration(value) {
  const match = String(value).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
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

async function runK6(targetUrl, extraEnv = {}, runIndex = 0) {
  const env = {
    LOAD_BASE_URL: targetUrl,
    LOAD_DURATION: DURATION,
    LOAD_WARMUP: WARMUP,
    LOAD_AUTH_USERS: "3",
    LOAD_PASSWORD: "123456",
    LOAD_RUN_ID: `${RUN_ID}-run${runIndex + 1}`,
    // O CWD do container k6 é /artifacts (o volume de /scripts é somente
    // leitura), então o prefixo relativo do artefato muda em relação à
    // execução direta no host.
    LOAD_ARTIFACT_DIR: "load",
    // As taxas de leitura e mutação chegam pelo ambiente para que a mensagem de
    // erro das guardas de orçamento seja acionável: ela diz "baixe
    // LOAD_MUTATION_PER_MIN", e sem este repasse a única forma de obedecer seria
    // editar o script. A guarda no main.js continua sendo quem valida, com os
    // mesmos números do src/lib/middleware-policy.ts.
    LOAD_READ_RPS: process.env.LOAD_READ_RPS || "25",
    LOAD_MUTATION_PER_MIN: process.env.LOAD_MUTATION_PER_MIN || "20",
    LOAD_AUTH_PER_MIN: process.env.LOAD_AUTH_PER_MIN || "4",
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

/**
 * Lê o JSON de uma execução e devolve os percentis por métrica.
 *
 * Devolve `null` para uma execução que não mediu nada. O k6 escreve um JSON
 * válido mesmo quando o `setup()` aborta — com todas as métricas em zero. Sem
 * este filtro, uma rodada que morreu entrava na mediana como 0 ms e produzia uma
 * conclusão errada em silêncio.
 */
async function collectRun(runIndex) {
  const file = path.join(root, "artifacts", "load", `${RUN_ID}-run${runIndex + 1}.json`);
  let data;
  try {
    const { readFile } = await import("node:fs/promises");
    data = JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }

  const read = data.metrics?.["http_req_duration{scenario:read,kind:api}"]?.values;
  if (!read) return null;
  if (!read["p(95)"] && !read.max) {
    console.log(`  execucao ${runIndex + 1} nao mediu leitura (abortada ou sem requisicoes); descartada`);
    return null;
  }
  return data;
}

/** Mediana de N valores. Com N par, devolve a média dos dois centrais. */
function percentile(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Mediana de N execuções por métrica. Reportar o p95 de uma rodada só esconde a
 * variância; a mediana com o intervalo mostra o quanto o número é estável, que é
 * a informação que o TCC precisa.
 */
function summarizeRuns(runs, failedRuns = []) {
  const usable = runs.filter(Boolean);
  if (!usable.length) {
    console.log("  nenhuma execucao produziu artefato para comparar");
    return;
  }

  const wanted = [
    ["leitura (API)", "http_req_duration{scenario:read,kind:api}"],
    ["paginas", "http_req_duration{scenario:read,kind:page}"],
    ["mutacoes", "http_req_duration{scenario:mutations,kind:api}"],
  ];

  console.log("");
  console.log(`=== Mediana de ${usable.length} execucoes (valores = p95 de cada execucao) ===`);
  console.log("metrica".padEnd(20) + "mediana p95".padStart(13) + "min".padStart(8) + "max".padStart(8));
  console.log("-".repeat(49));

  for (const [label, metric] of wanted) {
    const p95s = usable
      .map((run) => run.metrics?.[metric]?.values?.["p(95)"])
      .filter((value) => typeof value === "number");
    if (!p95s.length) continue;
    console.log(
      label.padEnd(20) +
        `${Math.round(percentile(p95s))}ms`.padStart(13) +
        `${Math.round(Math.min(...p95s))}ms`.padStart(8) +
        `${Math.round(Math.max(...p95s))}ms`.padStart(8),
    );
  }

  // `dropped_iterations` é o que casa com a dispersão observada: o gerador
  // descarta iterações quando não há VU livre, e descartar é excluir exatamente a
  // cauda do p95. Sem esta linha, um p95 "de 500 ms" pode ser de uma execução
  // que não sustentou a taxa nominal — e a carga real declarada deixa de
  // corresponder à medida.
  const dropped = usable.map((run) => run.metrics?.dropped_iterations?.values?.count ?? 0);
  const rate = usable
    .map((run) => Number(run.metrics?.http_reqs?.values?.rate ?? 0))
    .filter((value) => value > 0);
  console.log("");
  console.log(`iteracoes descartadas por execucao: ${dropped.join(", ")}`);
  if (failedRuns.length) {
    console.log(
      `execucoes fora dos limiares, excluidas da mediana: ${failedRuns.length} de ` +
        `${failedRuns.length + usable.length} (artefato bruto mantido em disco)`,
    );
  }
  if (rate.length) {
    const lo = Math.min(...rate);
    const hi = Math.max(...rate);
    // Espelha as constantes de tests/load/main.js: a taxa nominal de leitura em
    // req/s e quantas requisições cada iteração emite. A linha existia com um 6
    // fixo e um READ_RPS que nunca existiu neste arquivo, então o bloco só não
    // quebrava porque `rate` vinha vazio — nunca chegou a rodar.
    const readRps = Number(process.env.LOAD_READ_RPS || 25);
    const requestsPerIteration = 5; // 2 rotas de feed + /api/users/me + contagem + 1 página
    console.log(
      `req/s entregues: ${lo.toFixed(1)} a ${hi.toFixed(1)} ` +
        `(nominal ${readRps * requestsPerIteration} por iteracao de ${requestsPerIteration} requisicoes)`,
    );
    if (hi - lo > readRps) {
      console.log(
        "  AVISO: a carga entregue variou mais que uma iteracao entre execucoes; " +
          "compare os p95 com essa ressalva.",
      );
    }
  }
}

async function seed() {
  return node([path.join("scripts", "load-seed.mjs")], {
    env: { DATABASE_URL: DB_URL, LOAD_USERS },
  });
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
  const seedRun = await seed();
  if (seedRun !== 0) {
    fail("seed de carga falhou");
    return;
  }

  step(`Cenario principal: leitura + autenticacao + mutacoes (${RUNS} execucoes)`);
  // O polling de liveness precisa cobrir todas as execucoes e as folgas entre
  // elas, senao para de vigiar no meio da medicao.
  const runSpan =
    (parseDuration(WARMUP) + parseDuration(DURATION)) * RUNS + COOLDOWN * Math.max(0, RUNS - 1);
  const healthWatch = pollHealth(APP_URL, (runSpan + 120) * 1000, "principal");
  const mainRuns = [];
  const failedRuns = [];
  for (let i = 0; i < RUNS; i += 1) {
    const isLast = i === RUNS - 1;
    const withProbe = PROBE_ON_LAST ? isLast : true;
    console.log(`\n--- execucao ${i + 1}/${RUNS} (sonda de limite: ${withProbe ? "sim" : "nao"}) ---`);
    const code = await runK6("http://app:3000", { LOAD_PROBE: withProbe ? "1" : "0" }, i);
    const run = await collectRun(i);
    if (code !== 0) {
      fail(`execucao ${i + 1} ficou fora dos limiares`);
      // A execucao reprovada fica fora da mediana. O p95 de uma rodada que
      // cruzou limiar nao e evidencia do desempenho: pode ser o proprio
      // threshold alterando o cenario, e a mediana de 3_execucoes ficava
      // parecendo estavel com um terco dos dados reprovado dentro. O artefato
      // bruto continua no disco para diagnostico.
      if (run) {
        run.__thresholdFailure = true;
        failedRuns.push(run);
      }
    } else if (run) {
      mainRuns.push(run);
    }
    if (!isLast) {
      // Reesemear entre execucoes: cada uma cria mensagens e comentarios, e sem
      // isso as execucoes nao partem do mesmo estado e a comparacao perde
      // sentido. O seed trunca tudo, entao e barato e nao consome a janela de
      // login (ele escreve direto no banco, nao passa por HTTP).
      if (COOLDOWN > 0) {
        console.log(`  drenando a janela de login por ${COOLDOWN}s`);
        await delay(COOLDOWN * 1000);
      }
      console.log("  reseedando para a proxima execucao partir do mesmo estado");
      if ((await seed()) !== 0) fail("reseed entre execucoes falhou");
    }
  }
  await healthWatch;
  summarizeRuns(mainRuns, failedRuns);

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
      const degraded = await runK6(
        "http://app-degraded:3000",
        {
          LOAD_READ_ONLY: "true",
          LOAD_DURATION: SKEW,
          LOAD_RUN_ID: `${RUN_ID}-degraded`,
          // Ultima fase do orquestrador, entao a sonda pode rodar: nao ha
          // execucao seguinte para ser envenenada pela janela de login.
          LOAD_PROBE: "1",
        },
        0
      );
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
