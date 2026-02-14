import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// --- Rate limit configuration ---

type RateLimitRule = { maxRequests: number; interval: number };

const RATE_LIMIT_RULES: { pattern: string; rule: RateLimitRule }[] = [
  { pattern: "/api/auth/callback/credentials", rule: { maxRequests: 5, interval: 60_000 } },
  { pattern: "/api/auth/register", rule: { maxRequests: 5, interval: 60_000 } },
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

// Match /api/conversations/*/messages
function matchesConversationMessages(pathname: string): boolean {
  return /^\/api\/conversations\/[^/]+\/messages$/.test(pathname);
}

// --- IP extraction ---
// Prefer request.ip (reliable on Vercel), then last x-forwarded-for value
// (closest trusted proxy), then "anonymous"
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

// When IP is "anonymous", compute a weak fingerprint from headers to
// differentiate clients sharing the same missing-IP bucket
function getClientIdentifier(request: NextRequest): string {
  const ip = getIp(request);
  if (ip !== "anonymous") return ip;

  const ua = request.headers.get("user-agent") ?? "";
  const lang = request.headers.get("accept-language") ?? "";
  const accept = request.headers.get("accept") ?? "";
  // Simple hash: sum char codes to produce a numeric fingerprint
  const raw = `${ua}|${lang}|${accept}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `anon:${hash.toString(36)}`;
}

// --- Public routes (no auth required) ---
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

// --- Upstash rate limiter with in-memory dev fallback ---

const useUpstash = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

// Build Upstash rate limiters keyed by rule signature
const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(rule: RateLimitRule): Ratelimit {
  const key = `${rule.maxRequests}:${rule.interval}`;
  let limiter = upstashLimiters.get(key);
  if (!limiter) {
    // Convert ms to seconds for Upstash duration format (e.g. "60 s")
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

// --- In-memory fallback (local dev only) ---
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

// Best-effort cleanup for in-memory map (only used without Upstash)
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

// --- Unified rate limit check ---
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
      // Upstash failure — fall back to in-memory so we never skip rate limiting
      return checkRateLimitInMemory(key, rule);
    }
  }
  return checkRateLimitInMemory(key, rule);
}

// --- Middleware (standalone, not wrapped by withAuth) ---
// This runs BEFORE route handlers, including NextAuth's /api/auth/* routes.
// withAuth's inner function does NOT execute for /api/auth/* paths,
// so rate limiting must happen here at the top level.

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  cleanupRateLimitMap();

  // 1. Rate limiting — POST requests to specific paths
  if (request.method === "POST") {
    const clientId = getClientIdentifier(request);
    let rule: RateLimitRule | null = null;

    // Check conversation messages route
    if (matchesConversationMessages(pathname)) {
      rule = { maxRequests: 30, interval: 60_000 };
    } else {
      // Check static pattern rules (first match wins)
      for (const r of RATE_LIMIT_RULES) {
        if (pathname === r.pattern || pathname.startsWith(r.pattern + "/")) {
          rule = r.rule;
          break;
        }
      }
    }

    if (rule) {
      // Use user ID from JWT when available, fall back to client identifier
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

  // 2. Auth check — protect non-public routes
  if (!isPublicRoute(pathname)) {
    const token = await getToken({ req: request });
    if (!token) {
      // Redirect to login for page routes, return 401 for API routes
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
