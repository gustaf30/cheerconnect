import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";
import {
  createInMemoryRateLimiter,
  getClientIdentifier,
  getRateLimitRule,
  isPublicRoute,
  type RateLimitRule,
} from "@/lib/middleware-policy";

// --- Configuração de rate limit ---

// --- Rate limiter Upstash com fallback in-memory para dev ---

// Limiters Upstash indexados por assinatura da regra
const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(rule: RateLimitRule, redis: NonNullable<ReturnType<typeof getRedis>>): Ratelimit {
  const key = `${rule.maxRequests}:${rule.interval}`;
  let limiter = upstashLimiters.get(key);
  if (!limiter) {
    // Converte ms para segundos no formato Upstash (ex: "60 s")
    const seconds = Math.ceil(rule.interval / 1000);
    limiter = new Ratelimit({
      redis,
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
const inMemoryRateLimiter = createInMemoryRateLimiter();

// --- Checagem unificada de rate limit ---
async function checkRateLimit(
  key: string,
  rule: RateLimitRule
): Promise<{ success: boolean; retryAfter: number }> {
  const redis = getRedis();
  if (redis) {
    try {
      const limiter = getUpstashLimiter(rule, redis);
      const result = await limiter.limit(key);
      if (result.success) return { success: true, retryAfter: 0 };
      const retryAfter = Math.ceil(
        Math.max(0, result.reset - Date.now()) / 1000
      );
      return { success: false, retryAfter };
    } catch {
      // Falha no Upstash — fallback in-memory para nunca pular rate limiting
      return inMemoryRateLimiter.check(key, rule);
    }
  }
  return inMemoryRateLimiter.check(key, rule);
}

// --- Proxy (standalone, sem withAuth) ---
// Executa ANTES dos route handlers, incluindo /api/auth/* do NextAuth.
// A função interna do withAuth NÃO executa para rotas /api/auth/*,
// então rate limiting precisa acontecer aqui no nível raiz.

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  inMemoryRateLimiter.cleanup();

  // 1. Rate limiting — requisições sensíveis em rotas específicas
  const rateLimitRule = getRateLimitRule(pathname, request.method);
  if (rateLimitRule) {
    const clientId = getClientIdentifier(request.headers);
    const token = await getToken({ req: request });
    const tokenId = token?.sub || token?.id;
    const key = tokenId
      ? `user:${tokenId}:${pathname}`
      : `ip:${clientId}:${pathname}`;

    const result = await checkRateLimit(key, rateLimitRule);
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
     "/post/:path*",
     "/trending/:path*",
     "/profile/:path*",

    "/connections/:path*",
    "/teams/:path*",
    "/events/:path*",
    "/search/:path*",
    "/messages/:path*",
    "/settings/:path*",
    "/moderation/:path*",
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
     "/api/privacy/:path*",
     "/api/tags/:path*",
    "/api/reports/:path*",
    "/api/health/:path*",
    "/api/docs/:path*",
    "/api/cron/:path*",
    "/api/privacy/:path*",
  ],
};
