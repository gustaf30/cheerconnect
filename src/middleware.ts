import { withAuth } from "next-auth/middleware";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

// --- Edge-compatible in-memory rate limiter ---
const rateLimitMap = new Map<
  string,
  { count: number; resetTime: number }
>();

type RateLimitRule = { maxRequests: number; interval: number };

const RATE_LIMIT_RULES: { pattern: string; rule: RateLimitRule }[] = [
  { pattern: "/api/auth/register", rule: { maxRequests: 5, interval: 60_000 } },
  { pattern: "/api/posts", rule: { maxRequests: 10, interval: 60_000 } },
  { pattern: "/api/upload", rule: { maxRequests: 5, interval: 60_000 } },
  { pattern: "/api/teams", rule: { maxRequests: 10, interval: 60_000 } },
  { pattern: "/api/connections", rule: { maxRequests: 20, interval: 60_000 } },
  { pattern: "/api/comments", rule: { maxRequests: 20, interval: 60_000 } },
  { pattern: "/api/events", rule: { maxRequests: 10, interval: 60_000 } },
  { pattern: "/api/conversations", rule: { maxRequests: 10, interval: 60_000 } },
  { pattern: "/api/notifications", rule: { maxRequests: 30, interval: 60_000 } },
  { pattern: "/api/settings", rule: { maxRequests: 10, interval: 60_000 } },
];

// Match /api/conversations/*/messages
function matchesConversationMessages(pathname: string): boolean {
  return /^\/api\/conversations\/[^/]+\/messages$/.test(pathname);
}

function getIp(request: { headers: Headers; ip?: string }): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.ip ||
    "anonymous"
  );
}

function checkRateLimit(
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

// Periodic cleanup of expired entries (best-effort, runs on each request)
const MAX_RATE_LIMIT_ENTRIES = 10_000;
let lastCleanup = Date.now();
function cleanupRateLimitMap() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, value] of rateLimitMap) {
    if (now > value.resetTime) rateLimitMap.delete(key);
  }
  // Cap map size to prevent memory leak
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

export default withAuth(
  async function middleware(request) {
    cleanupRateLimitMap();

    // Rate limiting — only POST requests to specific paths
    if (request.method === "POST") {
      const { pathname } = request.nextUrl;
      const ip = getIp(request);
      let rule: RateLimitRule | null = null;

      // Check conversation messages route
      if (matchesConversationMessages(pathname)) {
        rule = { maxRequests: 30, interval: 60_000 };
      } else {
        // Check static pattern rules
        for (const r of RATE_LIMIT_RULES) {
          if (pathname === r.pattern || pathname.startsWith(r.pattern + "/")) {
            rule = r.rule;
            break;
          }
        }
      }

      if (rule) {
        // Use user ID from JWT when available, fall back to IP
        const token = await getToken({ req: request });
        const key = token?.sub
          ? `user:${token.sub}:${pathname}`
          : `ip:${ip}:${pathname}`;
        const result = checkRateLimit(key, rule);
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

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Rotas públicas
        if (
          pathname === "/" ||
          pathname.startsWith("/login") ||
          pathname.startsWith("/register") ||
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/api/health")
        ) {
          return true;
        }

        // Rotas protegidas requerem autenticação
        return !!token;
      },
    },
  }
);

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
