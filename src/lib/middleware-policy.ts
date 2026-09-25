export type RateLimitRule = { maxRequests: number; interval: number };

export const RATE_LIMIT_RULES: { pattern: string; rule: RateLimitRule }[] = [
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
  { pattern: "/api/users/me/reauthenticate", rule: { maxRequests: 3, interval: 60_000 } },
  { pattern: "/api/privacy/request", rule: { maxRequests: 3, interval: 60_000 } },
  { pattern: "/api/settings/password", rule: { maxRequests: 3, interval: 60_000 } },
  { pattern: "/api/settings", rule: { maxRequests: 10, interval: 60_000 } },
];

export function isPublicRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/docs") ||
    pathname.startsWith("/api/cron")
  );
}

export function getRateLimitRule(pathname: string, method: string): RateLimitRule | null {
  if (method === "DELETE" && pathname === "/api/users/me") {
    return { maxRequests: 3, interval: 60_000 };
  }
  if (method === "GET" && pathname === "/api/users/me/reauthenticate/verify") {
    return { maxRequests: 10, interval: 60_000 };
  }
  if (method !== "POST") return null;
  if (/^\/api\/conversations\/[^/]+\/messages$/.test(pathname)) {
    return { maxRequests: 30, interval: 60_000 };
  }
  for (const item of RATE_LIMIT_RULES) {
    if (pathname === item.pattern || pathname.startsWith(`${item.pattern}/`)) {
      return item.rule;
    }
  }
  return null;
}

export function createInMemoryRateLimiter() {
  const entries = new Map<string, { count: number; resetTime: number }>();
  let lastCleanup = Date.now();

  const check = (key: string, rule: RateLimitRule): { success: boolean; retryAfter: number } => {
    const now = Date.now();
    const entry = entries.get(key);
    if (!entry || now > entry.resetTime) {
      entries.set(key, { count: 1, resetTime: now + rule.interval });
      return { success: true, retryAfter: 0 };
    }
    if (entry.count >= rule.maxRequests) {
      return { success: false, retryAfter: Math.ceil((entry.resetTime - now) / 1000) };
    }
    entry.count += 1;
    return { success: true, retryAfter: 0 };
  };

  const cleanup = () => {
    const now = Date.now();
    if (now - lastCleanup < 60_000) return;
    lastCleanup = now;
    for (const [key, value] of entries) {
      if (now > value.resetTime) entries.delete(key);
    }
    if (entries.size > 10_000) {
      for (const key of entries.keys()) {
        if (entries.size <= 10_000) break;
        entries.delete(key);
      }
    }
  };

  return { check, cleanup, entries, getLastCleanup: () => lastCleanup };
}

export function getClientIdentifier(headers: Headers): string {
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").at(-1)?.trim();
    if (last) return last;
  }
  const raw = `${headers.get("user-agent") ?? ""}|${headers.get("accept-language") ?? ""}|${headers.get("accept") ?? ""}`;
  let hash = 0;
  for (let index = 0; index < raw.length; index++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(index)) | 0;
  }
  return `anon:${hash.toString(36)}`;
}
