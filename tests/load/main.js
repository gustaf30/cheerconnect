import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate } from "k6/metrics";
import { authHeaders, login, rateLimited } from "./helpers.js";
import { AUTH_P95_TARGET_MS, PAGE_P95_TARGET_MS, P95_TARGET_MS, thresholds } from "./thresholds.js";

const BASE_URL = __ENV.LOAD_BASE_URL || "http://app:3000";
const READ_ONLY = (__ENV.LOAD_READ_ONLY || "false") === "true";
const AUTH_USERS = Number(__ENV.LOAD_AUTH_USERS || 8);
const PASSWORD = __ENV.LOAD_PASSWORD || "123456";
const DURATION = __ENV.LOAD_DURATION || "5m";
const READ_RPS = Number(__ENV.LOAD_READ_RPS || 25);
const MUTATION_RPS = Number(__ENV.LOAD_MUTATION_RPS || 1);
// Janela de aquecimento, fora de toda métrica. Sem ela o p95 inclui pool de
// conexão frio, servidor frio e JIT, e a variância entre rodadas equivalentes
// passa a refletir o arranque em vez da carga. O p95 só começa a contar depois.
const WARMUP = __ENV.LOAD_WARMUP || "30s";
// O k6 não aceita aritmética em startTime, então a soma é resolvida aqui e
// passada como literal.
function durationMs(value) {
  const match = String(value).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!match) return 0;
  return (Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0)) * 1000;
}
function asDuration(ms) {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}m${seconds ? `${seconds}s` : ""}` : `${seconds}s`;
}
const PROBE_START = asDuration(durationMs(WARMUP) + durationMs(DURATION));
// O k6 exige rate inteiro, então a taxa do auth é expressa por minuto: o
// limitador é de 15/min por IP e todo o tráfego sai de um IP só.
const AUTH_PER_MIN = Number(__ENV.LOAD_AUTH_PER_MIN || 4);

// Cada requisição leva `kind`: o alvo de latência da API precisa ser avaliado
// sem as páginas, que são um terço do tráfego de leitura e bem mais pesadas.
const API = { kind: "api" };
const PAGE = { kind: "page" };

// Identidade das contas de carga. O padrão é o do seed local; a Medição B em
// produção usa prefixo e domínio próprios, para nunca colidir com uma conta real.
const EMAIL_PREFIX = __ENV.LOAD_EMAIL_PREFIX || "load";
const EMAIL_DOMAIN = __ENV.LOAD_EMAIL_DOMAIN || "load.test";
const emailFor = (index) => `${EMAIL_PREFIX}${index}@${EMAIL_DOMAIN}`;

// Conta de carga recién-criada, sem nenhum dado pessoal. As rotas que dependem
// de conexões, notificações ou feed de quem se segue responderiam vazio, e medir
// vazio é medir nada: dariam um p95 otimista sem qualquer relação com o custo
// real. Com LOAD_FRESH_ACCOUNT=1 o cenário fica só nas rotas que leem dados
// existentes. O que é excluído aqui continua coberto pela Medição A, onde os
// usuários semeados têm conexões e histórico.
const FRESH = (__ENV.LOAD_FRESH_ACCOUNT || "false") === "true";
const PROFILE = __ENV.LOAD_PROFILE || "load_user_1";
const PERSONAL_ROUTES = [
  "/api/posts?filter=following",
  "/api/posts?q=Post&filter=following",
  "/api/connections",
  "/api/notifications",
];

const loginSuccess = new Rate("login_success");
const limiterBlocked = new Rate("login_rate_limited");
const mutationLimited = new Rate("mutation_rate_limited");
const limiterEnforced = new Rate("rate_limiter_enforced");

// Só estas rotas são públicas (ver isPublicRoute); todo o resto exige sessão.
const publicRoutes = ["/", "/login", "/register", "/verify-email", "/api/docs"];
const ALL_READ_ROUTES = [
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
const readRoutes = FRESH
  ? ALL_READ_ROUTES.filter((route) => !PERSONAL_ROUTES.includes(route))
  : ALL_READ_ROUTES;
const readPages = ["/feed", "/trending", "/search?q=stunt", `/profile/${PROFILE}`];

const scenarios = {
  // O aquecimento exercita as mesmas rotas com a tag scenario:warmup, que
  // nenhum limiar referencia, então ele sai das métricas por construção em vez
  // de depender de exclusão posterior.
  warmup: {
    // `constant-arrival-rate` para ficar igual ao executor do cenário medido. O
    // que impede o aquecimento de vazar para a métrica é o `startTime` do
    // cenário medido, não o executor: nenhum limiar cita `scenario:warmup`, e o
    // k6 só materializa sub-métrica citada por threshold — então a fatia de
    // partida não é separável pelo artefato, nem trocando o executor.
    executor: "constant-arrival-rate",
    rate: Math.max(1, Math.floor(READ_RPS / 2)),
    timeUnit: "1s",
    duration: WARMUP,
    preAllocatedVUs: Math.max(10, READ_RPS),
    maxVUs: Math.max(40, READ_RPS * 4),
    exec: "readScenario",
    tags: { scenario: "warmup" },
  },
  read: {
    executor: "constant-arrival-rate",
    rate: READ_RPS,
    timeUnit: "1s",
    duration: DURATION,
    startTime: WARMUP,
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
    startTime: WARMUP,
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
    startTime: WARMUP,
    preAllocatedVUs: 5,
    maxVUs: 15,
    exec: "mutationScenario",
    tags: { scenario: "mutations" },
  };
}

// A sonda dispara 25 logins em rajada e satura a janela de 15/min por IP. Se
// rodasse em toda execução, o setup da execucao seguinte nao conseguiria
// autenticar e o k6 abortaria sem metricas. Por isso ela e opt-in por execucao e
// o orquestrador a liga so na ultima.
if (__ENV.LOAD_PROBE === "1") {
  scenarios.rateLimitProbe = {
    executor: "per-vu-iterations",
    vus: 1,
    iterations: 1,
    exec: "rateLimitProbe",
    // Começa depois que os cenários medidos terminam, para não competir pela
    // mesma janela de 15 logins/min por IP.
    startTime: PROBE_START,
    maxDuration: "60s",
  };
}

export const options = {
  scenarios,
  thresholds,
  // Descartar o corpo por padrão e pedi-lo explicitamente onde é lido. Guardar
  // todas as respostas — incluindo o HTML das páginas — consome CPU e memória do
  // gerador, que divide a mesma CPU com a app e o Postgres no Docker Desktop.
  // Quem precisa do corpo declara responseType: "text", que tem precedência.
  discardResponseBodies: true,
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
    const result = login(BASE_URL, emailFor(i), PASSWORD);
    if (result.ok) sessions.push({ index: i, session: result.session });
    else failures.push({ index: i, status: result.status, reason: result.reason });
  }

  if (sessions.length === 0) {
    throw new Error(`Nenhum login funcionou: ${JSON.stringify(failures)}`);
  }

  for (const entry of sessions) {
    const body = http
      .get(`${BASE_URL}/api/conversations`, { headers: authHeaders(entry.session), tags: API, responseType: "text" })
      .json();
    const list = Array.isArray(body) ? body : body?.conversations || [];
    entry.conversationId = list[0]?.id || null;
  }

  const postsBody = http
    .get(`${BASE_URL}/api/posts?filter=following`, { headers: authHeaders(sessions[0].session), tags: API, responseType: "text" })
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
      const response = http.get(`${BASE_URL}${route}`, { headers, tags: API });
      check(response, {
        "leitura 200": (r) => r.status === 200,
        "leitura sem 5xx": (r) => r.status < 500,
      }, API);
    }

    const me = http.get(`${BASE_URL}/api/users/me`, { headers, tags: API });
    check(me, { "perfil 200": (r) => r.status === 200 }, API);

    // A contagem de notificações é trivial numa conta sem notificações: incluí-la
    // só amoleceria o p95 de leitura com um número que não significa nada.
    if (!FRESH) {
      const count = http.get(`${BASE_URL}/api/notifications/count`, { headers, tags: API });
      check(count, { "contagem 200": (r) => r.status === 200 || r.status === 429 }, API);
    }
  });

  group("paginas", () => {
    const page = http.get(`${BASE_URL}${readPages[round % readPages.length]}`, {
      headers: { cookie: headers.Cookie },
      tags: PAGE,
    });
    check(page, {
      "pagina 200 ou redirecionada": (r) => r.status === 200 || r.status === 307 || r.status === 302,
    }, PAGE);
  });

  group("publicas", () => {
    // /api/docs é API; os demais caminhos de publicRoutes são páginas.
    const route = publicRoutes[round % publicRoutes.length];
    const kind = route === "/api/docs" ? API : PAGE;
    const publicResponse = http.get(`${BASE_URL}${route}`, { tags: kind });
    check(publicResponse, { "rota publica 200": (r) => r.status === 200 }, kind);
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
  const result = login(BASE_URL, emailFor(index), PASSWORD);
  const limited = result.status === 429;
  // Só conta como sucesso quando a sessão veio de fato; uma falha de login que
  // não seja 429 é um erro, não um sucesso disfarçado de "não barrado".
  loginSuccess.add(result.ok);
  limiterBlocked.add(limited);

    check(result, {
      "login aceito": () => result.ok,
      "login sem falha inesperada": () => result.ok || limited,
    }, API);

}

export function mutationScenario(data) {
  const round = __ITER;
  const entry = data.sessions[round % data.sessions.length];
  const headers = { ...authHeaders(entry.session), "content-type": "application/json" };

  if (entry.conversationId) {
    const response = http.post(
      `${BASE_URL}/api/conversations/${entry.conversationId}/messages`,
      JSON.stringify({ content: `carga ${__VU}-${round}` }),
      { headers, tags: API }
    );
    const limited = rateLimited(response);
    mutationLimited.add(limited);
      check(response, {
        "mensagem aceita": (r) => r.status === 200 || r.status === 201,
        "mensagem sem limite de taxa inesperado": (r) => r.status !== 429,
      }, API);

  }

  if (data.postId) {
    const response = http.post(
      `${BASE_URL}/api/posts/${data.postId}/comments`,
      JSON.stringify({ content: `comentario ${__VU}-${round}` }),
      { headers, tags: API }
    );
    const limited = rateLimited(response);
    mutationLimited.add(limited);
      check(response, {
        "comentario aceito": (r) => r.status === 200 || r.status === 201,
      }, API);

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
    const result = login(BASE_URL, emailFor(i % 8), PASSWORD);
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
  const value = (name) => metrics[name]?.values;

  const row = (label, name, target) => {
    const m = value(name);
    if (!m) return null;
    // O k6 materializa um sub-métrico zerado quando o cenário não existe (por
    // exemplo, mutações em execução somente leitura). Sem esta guarda, a linha
    // sairia com p95=0ms ao lado de um alvo, parecendo um aprovado de uma
    // métrica que nunca foi medida.
    const samples = m.count ?? m.values?.count;
    if (typeof samples === "number" && samples === 0) {
      lines.push(`${label.padEnd(22)} (cenario sem amostras — nao medido)`);
      return null;
    }
    if (m["p(95)"] === 0 && m.med === 0 && m.max === 0) {
      lines.push(`${label.padEnd(22)} (execucao sem requisicoes — nao medida)`);
      return null;
    }
    // O k6 nomeia o percentil 50 de `med`, não `median`.
    const med = Math.round(m.med ?? 0);
    const line = `${label.padEnd(22)} p95=${String(Math.round(m["p(95)"])).padStart(5)}ms  mediana=${String(med).padStart(4)}ms  max=${String(Math.round(m.max)).padStart(5)}ms  (alvo p95<${target}ms)`;
    lines.push(line);
    return m;
  };

  lines.push("");
  lines.push("=== Resumo da carga ===");
  lines.push(`alvo: ${BASE_URL} (${readOnly})`);
  lines.push(`duracao: ${WARMUP} aquecimento + ${DURATION} medido`);

  lines.push("");
  lines.push("-- API (alvo do criterio) --");
  const apiRead = row("leitura", "http_req_duration{scenario:read,kind:api}", P95_TARGET_MS);
  row("mutacoes", "http_req_duration{scenario:mutations,kind:api}", P95_TARGET_MS);
  row("auth", "http_req_duration{scenario:auth,kind:api}", AUTH_P95_TARGET_MS);

  lines.push("");
  lines.push("-- Paginas (cascas prerenderizadas, fora do alvo de API) --");
  const page = row("paginas", "http_req_duration{scenario:read,kind:page}", PAGE_P95_TARGET_MS);

  // A separação só é informativa se o resultado surpreender: com pages sendo
  // cascas prerenderizadas, elas devem sair mais baratas que a API. Se algum dia
  // inverterem, o indício é de que deixaram de ser estáticas. A leitura só vale
  // quando a trava de página passou — acima do alvo, a explicação contradiz o
  // próprio número.
  if (apiRead && page) {
    const ratio = page["p(95)"] / apiRead["p(95)"];
    if (page["p(95)"] < PAGE_P95_TARGET_MS) {
      lines.push("");
      lines.push(
        `p95 de pagina e ${ratio.toFixed(2)}x o p95 de API: as paginas sao cascas prerenderizadas e a API carrega todo o custo de servidor`,
      );
    } else {
      lines.push("");
      lines.push(
        `p95 de pagina (${Math.round(page["p(95)"])}ms) estourou a trava de ${PAGE_P95_TARGET_MS}ms: as rotas estaticas podem ter regredido para renderizacao dinamica`,
      );
    }
  }

  // Nota sobre partida: o aquecimento está fora dos limiares por construção
  // (startTime do cenário medido), então o p95 relatado é regime permanente e
  // não partida. O k6 1.3.0 executa o cenário de aquecimento mas não emite
  // sub-métrica com scenario:warmup no resumo, então a fatia de cold start não
  // é separável por aqui — mediria a partida em uma execução própria.


  const failedApi = value("http_req_failed{scenario:read,kind:api}");
  if (failedApi) lines.push(`erros de leitura (API): ${(failedApi.rate * 100).toFixed(2)}%`);

  const failedPage = value("http_req_failed{scenario:read,kind:page}");
  if (failedPage) lines.push(`erros de pagina: ${(failedPage.rate * 100).toFixed(2)}%`);

  const login = value("login_success");
  if (login) lines.push(`logins aceitos: ${(login.rate * 100).toFixed(2)}%`);

  const limited = value("mutation_rate_limited");
  if (limited) lines.push(`mutacoes barradas por limite de taxa: ${(limited.rate * 100).toFixed(2)}%`);

  const enforced = value("rate_limiter_enforced");
  if (enforced) {
    lines.push(`limitador de taxa funcionou: ${(enforced.rate * 100).toFixed(0)}% (sonda de correcao)`);
  }

  // JSON bruto junto do stdout: sem o artefato não há como recalcular
  // percentis, comparar rodadas ou montar a mediana de N execuções.
  // O diretório precisa existir: o k6 grava o arquivo, mas não cria a pasta.
  const dir = __ENV.LOAD_ARTIFACT_DIR || "artifacts/load";
  const stamp = (__ENV.LOAD_RUN_ID || "run").replace(/[^a-zA-Z0-9_-]/g, "-");
  const jsonName = `${dir}/${stamp}.json`;
  const summaryName = `${dir}/summary.txt`;

  lines.push("");
  lines.push(`resumo bruto: ${jsonName}`);
  lines.push("");

  return {
    stdout: lines.join("\n"),
    [jsonName]: JSON.stringify(data, null, 2),
    [summaryName]: lines.join("\n"),
  };
}
