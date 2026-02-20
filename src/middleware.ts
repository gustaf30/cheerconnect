import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// --- Configuração de rate limit ---

type RateLimitRule = { maxRequests: number; interval: number };

const RATE_LIMIT_RULES: { pattern: string; rule: RateLimitRule }[] = [
  { pattern: "/api/auth/callback/credentials", rule: { maxRequests: 15, interval: 60_000 } },
  { pattern: "/api/auth/register", rule: { maxRequests: 10, interval: 60_000 } },
  { pattern: "/api/auth/resend-verification", rule: { maxRequests: 3, interval: 60_000 } },
  { pattern: "/api/posts", rule: { maxRequests: 10, interval: 60_000 } },
  { pattern: "/api/upload", rule: { maxRequests: 5, interval: 60_000 } },
  { pattern: "/api/teams", rule: { maxRequests: 10, interval: 60_000 } },
  { pattern: "/api/connections", rule: { maxRequests: 20, interval: 60_000 } },
  { pattern: "/api/comments", rule: { maxRequests: 20, interval: 60_000 } },
  { pattern: "/api/events", rule: { maxRequests: 10, interval: 60_000 } },
  { pattern: "/api/conversations", rule: { maxRequests: 10, interval: 60_000 } },
  { pattern: "/api/notifications", rule: { maxRequests: 30, interval: 60_000 } },
  { pattern: "/api/settings/password", rule: { maxRequests: 3, interval: 60_000 } },
  { pattern: "/api/settings", rule: { maxRequests: 10, interval: 60_000 } },
];

// Verifica rota /api/conversations/*/messages
function matchesConversationMessages(pathname: string): boolean {
  return /^\/api\/conversations\/[^/]+\/messages$/.test(pathname);
}

// --- Extração de IP ---
// Prioriza request.ip (confiável no Vercel), depois último x-forwarded-for
// (proxy mais próximo), senão "anonymous"
function getIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    const last = parts[parts.length - 1]?.trim();
    if (last) return last;
  }

  return "anonymous";
}

// Quando IP é "anonymous", gera fingerprint fraco dos headers
// para diferenciar clientes no mesmo bucket sem IP
function getClientIdentifier(request: NextRequest): string {
  const ip = getIp(request);
  if (ip !== "anonymous") return ip;

  const ua = request.headers.get("user-agent") ?? "";
  const lang = request.headers.get("accept-language") ?? "";
  const accept = request.headers.get("accept") ?? "";
  // Hash simples: soma char codes para gerar fingerprint numérico
  const raw = `${ua}|${lang}|${accept}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `anon:${hash.toString(36)}`;
}

// --- Rotas públicas (sem auth) ---
function isPublicRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health")
  );
}

// --- Rate limiter Upstash com fallback in-memory para dev ---

const useUpstash = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

// Limiters Upstash indexados por assinatura da regra
const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(rule: RateLimitRule): Ratelimit {
  const key = `${rule.maxRequests}:${rule.interval}`;
  let limiter = upstashLimiters.get(key);
  if (!limiter) {
    // Converte ms para segundos no formato Upstash (ex: "60 s")
    const seconds = Math.ceil(rule.interval / 1000);
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(
        rule.maxRequests,
        `${seconds} s` as `${number} s`
      ),
      analytics: false,
      prefix: "rl",
    });
    upstashLimiters.set(key, limiter);
  }
  return limiter;
}

// --- Fallback in-memory (só dev local) ---
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimitInMemory(
  key: string,
  rule: RateLimitRule
): { success: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + rule.interval });
    return { success: true, retryAfter: 0 };
  }

  if (entry.count >= rule.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { success: false, retryAfter };
  }

  entry.count++;
  return { success: true, retryAfter: 0 };
}

// Limpeza best-effort do map in-memory (só sem Upstash)
const MAX_RATE_LIMIT_ENTRIES = 10_000;
let lastCleanup = Date.now();
function cleanupRateLimitMap() {
  if (useUpstash) return;
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, value] of rateLimitMap) {
    if (now > value.resetTime) rateLimitMap.delete(key);
  }
  if (rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
    const entriesToDelete = rateLimitMap.size - MAX_RATE_LIMIT_ENTRIES;
    let deleted = 0;
    for (const key of rateLimitMap.keys()) {
      if (deleted >= entriesToDelete) break;
      rateLimitMap.delete(key);
      deleted++;
    }
  }
}

// --- Checagem unificada de rate limit ---
async function checkRateLimit(
  key: string,
  rule: RateLimitRule
): Promise<{ success: boolean; retryAfter: number }> {
  if (useUpstash) {
    try {
      const limiter = getUpstashLimiter(rule);
      const result = await limiter.limit(key);
      if (result.success) return { success: true, retryAfter: 0 };
      const retryAfter = Math.ceil(
        Math.max(0, result.reset - Date.now()) / 1000
      );
      return { success: false, retryAfter };
    } catch {
      // Falha no Upstash — fallback in-memory para nunca pular rate limiting
      return checkRateLimitInMemory(key, rule);
    }
  }
  return checkRateLimitInMemory(key, rule);
}

// --- Middleware (standalone, sem withAuth) ---
// Executa ANTES dos route handlers, incluindo /api/auth/* do NextAuth.
// A função interna do withAuth NÃO executa para rotas /api/auth/*,
// então rate limiting precisa acontecer aqui no nível raiz.

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  cleanupRateLimitMap();

  // 1. Rate limiting — requisições POST em rotas específicas
  if (request.method === "POST") {
    const clientId = getClientIdentifier(request);
    let rule: RateLimitRule | null = null;

    // Rota de mensagens de conversa
    if (matchesConversationMessages(pathname)) {
      rule = { maxRequests: 30, interval: 60_000 };
    } else {
      // Regras estáticas (primeiro match vence)
      for (const r of RATE_LIMIT_RULES) {
        if (pathname === r.pattern || pathname.startsWith(r.pattern + "/")) {
          rule = r.rule;
          break;
        }
      }
    }

    if (rule) {
      // Usa user ID do JWT quando disponível, senão identificador do cliente
      const token = await getToken({ req: request });
      const key = token?.sub
        ? `user:${token.sub}:${pathname}`
        : `ip:${clientId}:${pathname}`;
      const result = await checkRateLimit(key, rule);
      if (!result.success) {
        return NextResponse.json(
          { error: "Muitas requisições. Tente novamente mais tarde." },
          {
            status: 429,
            headers: { "Retry-After": String(result.retryAfter) },
          }
        );
      }
    }
  }

  // 2. Checagem de auth — proteger rotas não-públicas
  if (!isPublicRoute(pathname)) {
    const token = await getToken({ req: request });
    if (!token) {
      // Redireciona para login em rotas de página, retorna 401 em rotas API
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Não autorizado" },
          { status: 401 }
        );
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/feed/:path*",
    "/profile/:path*",
    "/connections/:path*",
    "/teams/:path*",
    "/events/:path*",
    "/search/:path*",
    "/messages/:path*",
    "/settings/:path*",
    "/verify-email/:path*",
    "/api/auth/:path*",
    "/api/posts/:path*",
    "/api/users/:path*",
    "/api/connections/:path*",
    "/api/conversations/:path*",
    "/api/messages/:path*",
    "/api/comments/:path*",
    "/api/teams/:path*",
    "/api/events/:path*",
    "/api/achievements/:path*",
    "/api/career/:path*",
    "/api/upload/:path*",
    "/api/notifications/:path*",
    "/api/settings/:path*",
    "/api/tags/:path*",
    "/api/reports/:path*",
    "/api/health/:path*",
    "/api/docs/:path*",
    "/api/cron/:path*",
  ],
};
