import { describe, it, expect } from "vitest";

/**
 * Tests for the middleware's `authorized` callback logic.
 *
 * The actual callback is embedded inside withAuth() in src/middleware.ts:
 *   authorized: ({ token, req }) => {
 *     const { pathname } = req.nextUrl;
 *     if (
 *       pathname === "/" ||
 *       pathname.startsWith("/login") ||
 *       pathname.startsWith("/register") ||
 *       pathname.startsWith("/api/auth") ||
 *       pathname.startsWith("/api/health")
 *     ) return true;
 *     return !!token;
 *   }
 *
 * We replicate the pure logic here so we can unit test it without
 * importing the middleware (which has side-effect heavy dependencies).
 */

function authorized({
  token,
  pathname,
}: {
  token: unknown;
  pathname: string;
}): boolean {
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health")
  ) {
    return true;
  }
  return !!token;
}

describe("Middleware authorized callback", () => {
  describe("public routes (no token required)", () => {
    const publicPaths = [
      "/",
      "/login",
      "/login?callbackUrl=%2Ffeed",
      "/register",
      "/register?step=2",
      "/api/auth/signin",
      "/api/auth/callback/google",
      "/api/auth/session",
      "/api/auth/csrf",
      "/api/auth/providers",
      "/api/health",
      "/api/health/db",
    ];

    it.each(publicPaths)(
      "allows access to %s without token",
      (pathname) => {
        expect(authorized({ token: null, pathname })).toBe(true);
      }
    );

    it.each(publicPaths)(
      "allows access to %s with token",
      (pathname) => {
        expect(authorized({ token: { sub: "user-1" }, pathname })).toBe(true);
      }
    );
  });

  describe("protected routes (token required)", () => {
    const protectedPaths = [
      "/feed",
      "/profile",
      "/profile/johndoe",
      "/connections",
      "/teams",
      "/teams/my-team",
      "/events",
      "/search",
      "/messages",
      "/settings",
      "/api/posts",
      "/api/posts/abc123",
      "/api/users/me",
      "/api/connections",
      "/api/conversations",
      "/api/conversations/abc/messages",
      "/api/messages/count",
      "/api/comments/abc",
      "/api/teams/my-team/members",
      "/api/events",
      "/api/achievements",
      "/api/career",
      "/api/upload",
      "/api/notifications",
      "/api/settings",
      "/api/tags/cheerleading",
      "/api/reports",
    ];

    it.each(protectedPaths)(
      "denies access to %s without token",
      (pathname) => {
        expect(authorized({ token: null, pathname })).toBe(false);
      }
    );

    it.each(protectedPaths)(
      "allows access to %s with token",
      (pathname) => {
        expect(authorized({ token: { sub: "user-1" }, pathname })).toBe(true);
      }
    );
  });

  describe("edge cases", () => {
    it("rejects root-like paths that are not exactly '/'", () => {
      // "/dashboard" does not start with "/" as a public route
      expect(authorized({ token: null, pathname: "/dashboard" })).toBe(false);
    });

    it("rejects paths that merely contain 'login' but don't start with it", () => {
      expect(authorized({ token: null, pathname: "/not-login" })).toBe(false);
    });

    it("treats falsy token values as unauthenticated", () => {
      expect(authorized({ token: undefined, pathname: "/feed" })).toBe(false);
      expect(authorized({ token: null, pathname: "/feed" })).toBe(false);
      expect(authorized({ token: 0, pathname: "/feed" })).toBe(false);
      expect(authorized({ token: "", pathname: "/feed" })).toBe(false);
    });

    it("treats truthy token values as authenticated", () => {
      expect(authorized({ token: { sub: "123" }, pathname: "/feed" })).toBe(
        true
      );
      expect(authorized({ token: true, pathname: "/feed" })).toBe(true);
      expect(authorized({ token: { name: "Test" }, pathname: "/feed" })).toBe(
        true
      );
    });
  });
});

/**
 * Tests for the middleware's matcher config.
 *
 * The config.matcher array defines which routes the middleware runs on.
 * These tests validate the expected routes are present.
 */
describe("Middleware matcher config", () => {
  // Replicate the config from middleware.ts
  const matcherPatterns = [
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
  ];

  it("includes all protected page routes", () => {
    const pageRoutes = [
      "/feed/:path*",
      "/profile/:path*",
      "/connections/:path*",
      "/teams/:path*",
      "/events/:path*",
      "/search/:path*",
      "/messages/:path*",
      "/settings/:path*",
    ];
    for (const route of pageRoutes) {
      expect(matcherPatterns).toContain(route);
    }
  });

  it("includes all API routes", () => {
    const apiRoutes = [
      "/api/posts/:path*",
      "/api/users/:path*",
      "/api/connections/:path*",
      "/api/conversations/:path*",
      "/api/teams/:path*",
      "/api/events/:path*",
      "/api/upload/:path*",
      "/api/notifications/:path*",
    ];
    for (const route of apiRoutes) {
      expect(matcherPatterns).toContain(route);
    }
  });

  it("does NOT include public auth routes", () => {
    // Auth routes should not be in the matcher - they are handled by NextAuth
    const authPatterns = matcherPatterns.filter((p) =>
      p.startsWith("/api/auth")
    );
    expect(authPatterns).toHaveLength(0);
  });

  it("does NOT include the landing page", () => {
    expect(matcherPatterns).not.toContain("/");
    expect(matcherPatterns).not.toContain("/:path*");
  });
});
