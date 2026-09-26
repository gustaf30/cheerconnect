// Fase 0 da LOAD-001: quantas consultas cada requisição executa de fato.
//
// A contagem vem do pg_stat_statements, ou seja, do que o Postgres realmente
// executou — sem instrumentar a aplicação. O número define a taxa segura do
// ensaio contra produção, porque é ele que traduz requisições em carga de banco.
//
//   node scripts/measure-query-fanout.mjs
//
// Requer a pilha de carga no ar (docker-compose.load.yml) e a base semeada.

import { Pool } from "pg";
import process from "node:process";

const APP_URL = process.env.LOAD_APP_URL || "http://localhost:3100";
const DB_URL =
  process.env.LOAD_DB_URL || "postgresql://load:load@localhost:55432/cheerconnect_load";
const REQUESTS = Number(process.env.FANOUT_REQUESTS || 20);
const EMAIL = process.env.FANOUT_EMAIL || "load0@load.test";
const PASSWORD = process.env.FANOUT_PASSWORD || "123456";

const pool = new Pool({ connectionString: DB_URL, max: 2 });

const jar = new Map();
function storeCookies(response) {
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

async function login() {
  const csrf = await fetch(`${APP_URL}/api/auth/csrf`);
  storeCookies(csrf);
  const { csrfToken } = await csrf.json();

  const response = await fetch(`${APP_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD, json: "true" }),
    redirect: "manual",
  });
  storeCookies(response);

  if (![...jar.keys()].some((k) => k.includes("session-token"))) {
    throw new Error(`login falhou (status ${response.status})`);
  }
}

async function totalCalls() {
  const { rows } = await pool.query(
    "SELECT COALESCE(sum(calls), 0)::bigint AS total FROM pg_stat_statements",
  );
  return Number(rows[0].total);
}

async function hit(path) {
  const response = await fetch(`${APP_URL}${path}`, {
    headers: { cookie: cookieHeader(), accept: "application/json" },
  });
  return response.status;
}

// Rotas derivadas de readScenario, para que o número corresponda ao ensaio.
const TARGETS = [
  "/api/posts?filter=following",
  "/api/posts?filter=all",
  "/api/posts?q=carga&filter=all",
  "/api/events?scope=upcoming",
  "/api/tags/trending",
  "/api/connections",
  "/api/notifications",
  "/api/users/me",
  "/api/notifications/count",
];

async function measure(label, path) {
  // Uma requisição de aquecimento: pool, JIT e plano de consulta saem da
  // medição, senão a primeira chamada de cada rota domina a média.
  await hit(path);
  await pool.query("SELECT pg_stat_statements_reset()");

  for (let i = 0; i < REQUESTS; i += 1) await hit(path);

  const calls = await totalCalls();
  return { label, path, calls, perRequest: calls / REQUESTS };
}

async function main() {
  await pool.query("CREATE EXTENSION IF NOT EXISTS pg_stat_statements");
  await login();

  console.log(`alvo: ${APP_URL}`);
  console.log(`${REQUESTS} requisicoes por rota, com aquecimento previo\n`);
  console.log("rota".padEnd(36) + "consultas/req");
  console.log("-".repeat(52));

  const results = [];
  for (const path of TARGETS) {
    const result = await measure(path, path);
    results.push(result);
    console.log(`${result.path.slice(0, 35).padEnd(36)}${result.perRequest.toFixed(1)}`);
  }

  const apiOnly = results.filter((r) => !r.path.startsWith("/api/users/me"));
  const mean = apiOnly.reduce((sum, r) => sum + r.perRequest, 0) / apiOnly.length;
  const heaviest = results.reduce((a, b) => (a.perRequest > b.perRequest ? a : b));

  console.log("-".repeat(52));
  console.log(`media das rotas de leitura: ${mean.toFixed(1)} consultas/req`);
  console.log(`rota mais pesada: ${heaviest.path} (${heaviest.perRequest.toFixed(1)})`);
  console.log(
    `\nem ${REQUESTS} requisicoes: ${(mean * REQUESTS).toFixed(0)} consultas no Postgres`,
  );
  console.log(
    `a 150 req/s isso vira ${(150 * mean).toFixed(0)} consultas/s contra o banco`,
  );
}

main()
  .catch((error) => {
    console.error("ERRO:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
