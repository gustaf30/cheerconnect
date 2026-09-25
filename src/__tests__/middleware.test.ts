import { describe, expect, it } from "vitest";
import { config } from "@/proxy";
import { getClientIdentifier, getRateLimitRule, isPublicRoute } from "@/lib/middleware-policy";

const publicPaths = [
  "/",
  "/login",
  "/register",
  "/verify-email",
  "/api/auth/session",
  "/api/health",
  "/api/docs",
  "/api/cron/maintenance",
];

const protectedPaths = [
  "/feed",
  "/profile/user",
  "/connections",
  "/teams/team",
  "/events",
  "/search",
  "/messages",
  "/settings",
  "/api/posts",
  "/api/users/me",
  "/api/connections",
  "/api/conversations/abc/messages",
  "/api/teams/team/members",
  "/api/events",
  "/api/upload",
  "/api/notifications",
  "/api/settings",
  "/api/tags/cheer",
  "/api/reports",
  "/api/privacy/export",
  "/moderation",
];

describe("real middleware policy", () => {
  it.each(publicPaths)("keeps %s public", (pathname) => {
    expect(isPublicRoute(pathname)).toBe(true);
  });

  it.each(protectedPaths)("protects %s", (pathname) => {
    expect(isPublicRoute(pathname)).toBe(false);
  });

  it("uses the shared POST rate-limit rules", () => {
    expect(getRateLimitRule("/api/auth/register", "POST")).toEqual({ maxRequests: 10, interval: 60_000 });
    expect(getRateLimitRule("/api/conversations/abc/messages", "POST")).toEqual({ maxRequests: 30, interval: 60_000 });
    expect(getRateLimitRule("/api/posts", "GET")).toBeNull();
    expect(getRateLimitRule("/api/unknown", "POST")).toBeNull();
  });

  it("derives a stable client identifier from forwarded headers", () => {
    const headers = new Headers({ "x-forwarded-for": "10.0.0.1, 10.0.0.2" });
    expect(getClientIdentifier(headers)).toBe("10.0.0.2");
    expect(getClientIdentifier(new Headers({ "x-real-ip": "127.0.0.1" }))).toBe("127.0.0.1");
  });

  it("keeps the middleware matcher aligned with protected pages and APIs", () => {
    expect(config.matcher).toEqual(expect.arrayContaining([
      "/feed/:path*",
      "/post/:path*",
      "/trending/:path*",
      "/settings/:path*",
      "/moderation/:path*",
      "/api/privacy/:path*",
      "/api/cron/:path*",
    ]));
  });
});
