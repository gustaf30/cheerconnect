import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate } from "k6/metrics";
import { authHeaders, login, rateLimited } from "./helpers.js";
import { AUTH_P95_TARGET_MS, P95_TARGET_MS, thresholds } from "./thresholds.js";

const BASE_URL = __ENV.LOAD_BASE_URL || "http://app:3000";
const READ_ONLY = (__ENV.LOAD_READ_ONLY || "false") === "true";
const AUTH_USERS = Number(__ENV.LOAD_AUTH_USERS || 8);
const PASSWORD = __ENV.LOAD_PASSWORD || "123456";
const DURATION = __ENV.LOAD_DURATION || "2m";
const READ_RPS = Number(__ENV.LOAD_READ_RPS || 25);
const MUTATION_RPS = Number(__ENV.LOAD_MUTATION_RPS || 1);
// O k6 exige rate inteiro, então a taxa do auth é expressa por minuto: o
// limitador é de 15/min por IP e todo o tráfego sai de um IP só.
const AUTH_PER_MIN = Number(__ENV.LOAD_AUTH_PER_MIN || 4);

const loginSuccess = new Rate("login_success");
const limiterBlocked = new Rate("login_rate_limited");
const mutationLimited = new Rate("mutation_rate_limited");
const limiterEnforced = new Rate("rate_limiter_enforced");

// Só estas rotas são públicas (ver isPublicRoute); todo o resto exige sessão.
const publicRoutes = ["/", "/login", "/register", "/verify-email", "/api/docs"];
const readRoutes = [
  "/api/posts?filter=following",
  "/api/posts?filter=all",
  "/api/posts?q=carga&filter=all",
  "/api/posts?q=Post&filter=following",
  "/api/events?scope=upcoming",
  "/api/events?scope=past",
  "/api/tags/trending",
  "/api/connections",
  "/api/notifications",
];
const readPages = ["/feed", "/trending", "/search?q=stunt", "/profile/load_user_1"];

const scenarios = {
  read: {
    executor: "constant-arrival-rate",
    rate: READ_RPS,
    timeUnit: "1s",
    duration: DURATION,
    preAllocatedVUs: Math.max(10, READ_RPS),
    maxVUs: Math.max(40, READ_RPS * 4),
    exec: "readScenario",
    tags: { scenario: "read" },
  },
  auth: {
    executor: "constant-arrival-rate",
    rate: AUTH_PER_MIN,
    timeUnit: "1m",
    duration: DURATION,
    preAllocatedVUs: 2,
    maxVUs: 4,
    exec: "authScenario",
    tags: { scenario: "auth" },
  },
};

// A chave precisa desaparecer de verdade: `mutations: undefined` ainda é lida
// pelo k6 como um cenário sem executor definido e aborta a execução inteira.
if (!READ_ONLY) {
  scenarios.mutations = {
    executor: "constant-arrival-rate",
    rate: MUTATION_RPS,
    timeUnit: "1s",
    duration: DURATION,
    preAllocatedVUs: 5,
    maxVUs: 15,
    exec: "mutationScenario",
    tags: { scenario: "mutations" },
  };
}

scenarios.rateLimitProbe = {
  executor: "per-vu-iterations",
  vus: 1,
  iterations: 1,
  exec: "rateLimitProbe",
  // Começa depois que os cenários medidos terminam, para não competir pela
  // mesma janela de 15 logins/min por IP.
  startTime: DURATION,
  maxDuration: "60s",
};

export const options = {
  scenarios,
  thresholds,
  // Precisa ser false: o setup lê corpos (conversas e posts) para montar os
  // alvos das mutações. Nenhuma iteração do laço quente parseia corpo.
  discardResponseBodies: false,
};

/**
 * Cada sessão precisa dos seus próprios alvos: a chave de rate limit de
 * mensagens inclui o id da conversa, e postar na conversa de outra sessão daria
 * 403 por não ser participante.
 */
export function setup() {
  const sessions = [];
  const failures = [];

  for (let i = 0; i < AUTH_USERS; i++) {
    const result = login(BASE_URL, `load${i}@load.test`, PASSWORD);
    if (result.ok) sessions.push({ index: i, session: result.session });
    else failures.push({ index: i, status: result.status, reason: result.reason });
  }

  if (sessions.length === 0) {
    throw new Error(`Nenhum login funcionou: ${JSON.stringify(failures)}`);
  }

  for (const entry of sessions) {
    const body = http
      .get(`${BASE_URL}/api/conversations`, { headers: authHeaders(entry.session) })
      .json();
    const list = Array.isArray(body) ? body : body?.conversations || [];
    entry.conversationId = list[0]?.id || null;
  }

  const postsBody = http
    .get(`${BASE_URL}/api/posts?filter=following`, { headers: authHeaders(sessions[0].session) })
    .json();
  const postList = Array.isArray(postsBody) ? postsBody : postsBody?.posts || [];
  const postId = postList[0]?.id || null;

  return { sessions, postId, failures };
}

export function readScenario(data) {
  const round = __ITER;
  const entry = data.sessions[round % data.sessions.length];
  const headers = authHeaders(entry.session);

  group("leitura autenticada", () => {
    for (const route of [readRoutes[round % readRoutes.length], readRoutes[(round + 3) % readRoutes.length]]) {
      const response = http.get(`${BASE_URL}${route}`, { headers });
      check(response, {
        "leitura 200": (r) => r.status === 200,
        "leitura sem 5xx": (r) => r.status < 500,
      });
    }

    const me = http.get(`${BASE_URL}/api/users/me`, { headers });
    check(me, { "perfil 200": (r) => r.status === 200 });

    const count = http.get(`${BASE_URL}/api/notifications/count`, { headers });
    check(count, { "contagem 200": (r) => r.status === 200 || r.status === 429 });
  });

  group("paginas", () => {
    const page = http.get(`${BASE_URL}${readPages[round % readPages.length]}`, {
      headers: { cookie: headers.Cookie },
    });
    check(page, {
      "pagina 200 ou redirecionada": (r) => r.status === 200 || r.status === 307 || r.status === 302,
    });
  });

  group("publicas", () => {
    const publicResponse = http.get(`${BASE_URL}${publicRoutes[round % publicRoutes.length]}`);
    check(publicResponse, { "rota publica 200": (r) => r.status === 200 });
  });
}

/**
 * Login sob carga. O limitador é de 15/min por IP e todo o tráfego do k6 vem
 * de um IP só, então a taxa é baixa de propósito e o 429 é aceito como
 * comportamento válido do limitador.
 */
export function authScenario() {
  // O índice precisa ficar dentro da faixa de usuários semeados, senão o login
  // cai em "usuário não encontrado" e a métrica mede erro, não latência.
  const count = Number(__ENV.LOAD_USERS || 30);
  const index = Math.floor(Math.random() * count);
  const result = login(BASE_URL, `load${index}@load.test`, PASSWORD);
  const limited = result.status === 429;
  // Só conta como sucesso quando a sessão veio de fato; uma falha de login que
  // não seja 429 é um erro, não um sucesso disfarçado de "não barrado".
  loginSuccess.add(result.ok);
  limiterBlocked.add(limited);

  check(result, {
    "login aceito": () => result.ok,
    "login sem falha inesperada": () => result.ok || limited,
  });
}

export function mutationScenario(data) {
  const round = __ITER;
  const entry = data.sessions[round % data.sessions.length];
  const headers = { ...authHeaders(entry.session), "content-type": "application/json" };

  if (entry.conversationId) {
    const response = http.post(
      `${BASE_URL}/api/conversations/${entry.conversationId}/messages`,
      JSON.stringify({ content: `carga ${__VU}-${round}` }),
      { headers }
    );
    const limited = rateLimited(response);
    mutationLimited.add(limited);
    check(response, {
      "mensagem aceita": (r) => r.status === 200 || r.status === 201,
      "mensagem sem limite de taxa inesperado": (r) => r.status !== 429,
    });
  }

  if (data.postId) {
    const response = http.post(
      `${BASE_URL}/api/posts/${data.postId}/comments`,
      JSON.stringify({ content: `comentario ${__VU}-${round}` }),
      { headers }
    );
    const limited = rateLimited(response);
    mutationLimited.add(limited);
    check(response, {
      "comentario aceito": (r) => r.status === 200 || r.status === 201,
    });
  }

  sleep(0.2);
}

/**
 * Verificação determinística de que o limitador bloqueia de fato. Não é carga:
 * são logins encadeados disparados depois que os cenários medidos terminam,
 * para não gastar a janela de taxa e não contaminar o p95 de auth. Sem isso a
 * suíte provaria latência, não corretude do limitador.
 */
export function rateLimitProbe() {
  let blocked = 0;
  let accepted = 0;

  for (let i = 0; i < 25; i++) {
    const result = login(BASE_URL, `load${i % 8}@load.test`, PASSWORD);
    if (result.status === 429) blocked += 1;
    else if (result.ok) accepted += 1;
  }

  limiterEnforced.add(blocked > 0);
  check(null, {
    "limitador bloqueou excessos": () => blocked > 0,
    "login continua aceito dentro do limite": () => accepted > 0,
  });
}

export function handleSummary(data) {
  const metrics = data.metrics || {};
  const lines = [];
  const readOnly = READ_ONLY ? "somente leitura" : "com mutações";

  lines.push("");
  lines.push("=== Resumo da carga ===");
  lines.push(`alvo: ${BASE_URL} (${readOnly}) | duracao: ${DURATION}`);

  const read = metrics["http_req_duration{scenario:read}"]?.values;
  if (read) {
    lines.push(
      `leitura   p95=${read["p(95)"]}ms mediana=${read.median}ms max=${read.max}ms (alvo p95<${P95_TARGET_MS}ms)`
    );
  }

  const mutations = metrics["http_req_duration{scenario:mutations}"]?.values;
  if (mutations) {
    lines.push(
      `mutacoes  p95=${mutations["p(95)"]}ms mediana=${mutations.median}ms (alvo p95<${P95_TARGET_MS}ms)`
    );
  }

  const auth = metrics["http_req_duration{scenario:auth}"]?.values;
  if (auth) {
    lines.push(
      `auth      p95=${auth["p(95)"]}ms (alvo p95<${AUTH_P95_TARGET_MS}ms, bcrypt custo 12)`
    );
  }

  const failed = metrics["http_req_failed{scenario:read}"]?.values;
  if (failed) lines.push(`erros leitura: ${(failed.rate * 100).toFixed(2)}%`);

  const login = metrics.login_success?.values;
  if (login) lines.push(`logins aceitos: ${(login.rate * 100).toFixed(2)}%`);

  const limited = metrics.mutation_rate_limited?.values;
  if (limited) lines.push(`mutacoes barradas por limite de taxa: ${(limited.rate * 100).toFixed(2)}%`);

  const enforced = metrics.rate_limiter_enforced?.values;
  if (enforced) {
    lines.push(
      `limitador de taxa funcionou: ${(enforced.rate * 100).toFixed(0)}% (sonda de correcao)`
    );
  }

  lines.push("");

  return { stdout: lines.join("\n") };
}
