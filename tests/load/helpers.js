import http from "k6/http";
import { Rate, Trend } from "k6/metrics";

export const loginSuccess = new Rate("login_success");
export const loginLatency = new Trend("login_latency", true);
export const mutationRateLimited = new Rate("mutation_rate_limited");

/**
 * No k6, response.cookies[nome] é um array de objetos {name, value}, e não uma
 * string. Esta função normaliza os dois formatos para pares "nome=valor".
 */
export function cookiePairs(response) {
  const pairs = [];
  for (const entries of Object.values(response.cookies || {})) {
    for (const cookie of Array.isArray(entries) ? entries : [entries]) {
      if (cookie && typeof cookie.value === "string") {
        pairs.push(`${cookie.name}=${cookie.value}`);
      }
    }
  }
  return pairs;
}

export function findCookie(response, names) {
  for (const pair of cookiePairs(response)) {
    const name = pair.slice(0, pair.indexOf("="));
    if (names.includes(name)) return pair;
  }
  return null;
}

// Em produção useSecureCookies é verdadeiro, então o NextAuth prefixa os
// cookies com __Host- (CSRF) e __Secure- (sessão).
const CSRF_COOKIE_NAMES = ["__Host-next-auth.csrf-token", "next-auth.csrf-token"];
const SESSION_COOKIE_NAMES = [
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

export function sessionCookie(response) {
  return findCookie(response, SESSION_COOKIE_NAMES);
}

export function authHeaders(sessionToken) {
  const headers = { accept: "application/json" };
  if (sessionToken) headers.Cookie = sessionToken;
  return headers;
}

export function rateLimited(response) {
  return response.status === 429;
}

/**
 * Login via NextAuth credentials: as duas etapas do protocolo, o token de CSRF
 * e depois o callback, extraindo o cookie de sessão da resposta.
 */
export function login(baseUrl, email, password) {
  const csrfResponse = http.get(`${baseUrl}/api/auth/csrf`);
  if (csrfResponse.status !== 200) {
    return { ok: false, reason: "csrf", status: csrfResponse.status, session: null };
  }

  const csrfToken = csrfResponse.json("csrfToken");
  const csrfCookie = findCookie(csrfResponse, CSRF_COOKIE_NAMES);

  const response = http.post(
    `${baseUrl}/api/auth/callback/credentials`,
    { csrfToken, email, password, json: "true" },
    {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        ...(csrfCookie ? { Cookie: csrfCookie } : {}),
      },
      redirects: 0,
    }
  );

  const session = sessionCookie(response);
  if (!session) {
    return { ok: false, reason: "no_session", status: response.status, session: null };
  }
  return { ok: true, reason: "ok", status: response.status, session };
}
