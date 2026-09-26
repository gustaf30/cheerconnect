// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetToken } = vi.hoisted(() => ({ mockGetToken: vi.fn() }));

vi.mock("next-auth/jwt", () => ({ getToken: mockGetToken }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn((o) => ({ id: "google", ...o })) }));
vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((o) => ({ id: "credentials", ...o })),
}));
vi.mock("bcryptjs", () => ({ default: { compare: vi.fn(), hash: vi.fn() } }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/security-events", () => ({ logSecurityEvent: vi.fn() }));

import proxy from "@/proxy";
import { usesSecureCookies } from "@/lib/auth-cookies";

const ORIGINAL_URL = process.env.NEXTAUTH_URL;
const ORIGINAL_VERCEL = process.env.VERCEL as "1" | undefined;
const ORIGINAL_TRUST_HOST = process.env.AUTH_TRUST_HOST as "1" | undefined;

function setEnv(values: { url?: string | null; vercel?: "1" | null; trustHost?: "1" | null }) {
  if (values.url === null) delete process.env.NEXTAUTH_URL;
  else if (values.url !== undefined) process.env.NEXTAUTH_URL = values.url;
  if (values.vercel === null) delete process.env.VERCEL;
  else if (values.vercel !== undefined) process.env.VERCEL = values.vercel;
  if (values.trustHost === null) delete process.env.AUTH_TRUST_HOST;
  else if (values.trustHost !== undefined) process.env.AUTH_TRUST_HOST = values.trustHost;
}

beforeEach(() => {
  mockGetToken.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  setEnv({ url: ORIGINAL_URL, vercel: ORIGINAL_VERCEL, trustHost: ORIGINAL_TRUST_HOST });
});

/**
 * Carrega os authOptions de verdade, com o ambiente já ajustado.
 *
 * `useSecureCookies` é avaliado no import do módulo, então testar mais de um
 * valor exige reiniciar o registry entre imports. Sem isso o teste leria sempre o
 * valor congelado do primeiro import e pareceria passar sem verificar nada.
 */
async function loadWriteDecision(url: string | null) {
  setEnv({ url, vercel: null, trustHost: null });
  vi.resetModules();
  const { authOptions } = await import("@/lib/auth");
  return authOptions.useSecureCookies as boolean;
}

/**
 * Regressão: em produção com NEXTAUTH_URL em http://, a escrita do cookie usava
 * o prefixo __Secure- (derivado de NODE_ENV) enquanto a leitura procurava o nome
 * sem prefixo (derivado do protocolo da URL). O token nunca era encontrado e
 * toda rota autenticada respondia 401.
 */
describe("coerência do cookie de sessão", () => {
  it("a escrita e a leitura decidem o mesmo valor", async () => {
    // Esta é a asserção que pega o bug. As duas pontas independentes do
    // NextAuth — authOptions.useSecureCookies, que nomeia o cookie na escrita, e
    // o secureCookie passado ao getToken, que o procura na leitura — precisam
    // concordar. Com `useSecureCookies: NODE_ENV === "production"` no auth.ts e
    // o protocolo da URL no proxy, esta linha falha.
    for (const url of ["https://app.example.com", "http://localhost:3000", null]) {
      const write = await loadWriteDecision(url);

      setEnv({ url, vercel: null, trustHost: null });
      const read = usesSecureCookies();

      expect(write).toBe(read);
    }
  });

  it("trata o protocolo da URL como fonte da verdade", () => {
    setEnv({ url: "https://cheerconnect.vercel.app" });
    expect(usesSecureCookies()).toBe(true);

    setEnv({ url: "http://localhost:3000" });
    expect(usesSecureCookies()).toBe(false);
  });

  it("sem URL configurada, decide pelo ambiente como faz o NextAuth", () => {
    // `getToken` usa `NEXTAUTH_URL?.startsWith("https://") ?? !!process.env.VERCEL`
    // e `detect-origin` também aceita AUTH_TRUST_HOST, para implantação atrás de
    // proxy. Devolver false num desses casos trocaria o 401 por um cookie sem o
    // atributo Secure, que é falha silenciosa.
    setEnv({ url: null, vercel: "1", trustHost: null });
    expect(usesSecureCookies()).toBe(true);

    setEnv({ url: null, vercel: null, trustHost: "1" });
    expect(usesSecureCookies()).toBe(true);

    setEnv({ url: null, vercel: null, trustHost: null });
    expect(usesSecureCookies()).toBe(false);
  });

  it("o proxy passa o mesmo critério nas duas leituras", async () => {
    // Duas chamadas distintas a getToken no proxy: a do rate limit, que só
    // dispara em rotas com regra, e a da checagem de autenticação. Se uma
    // divergir, o bug reaparece em parte das rotas.
    const cases = [
      { url: "https://app.example.com", expected: true },
      { url: "http://localhost:3000", expected: false },
    ] as const;

    for (const { url, expected } of cases) {
      setEnv({ url, vercel: null, trustHost: null });

      // Leitura da checagem de autenticação, numa GET sem regra de limite.
      mockGetToken.mockClear();
      await proxy(new NextRequest(new URL("/api/posts?filter=all", url)));
      expect(mockGetToken).toHaveBeenCalledTimes(1);
      expect(mockGetToken.mock.calls[0][0]).toMatchObject({ secureCookie: expected });

      // Leitura do rate limit, num POST que tem regra (10/min em /api/posts).
      // Nesse caminho getToken é chamado duas vezes — a do rate limit e a da
      // autenticação — e as duas precisam trazer o mesmo critério.
      mockGetToken.mockClear();
      await proxy(new NextRequest(new URL("/api/posts", url), { method: "POST", body: "{}" }));
      expect(mockGetToken).toHaveBeenCalledTimes(2);
      for (const call of mockGetToken.mock.calls) {
        expect(call[0]).toMatchObject({ secureCookie: expected });
      }
    }
  });

  it("nega rota protegida quando não há sessão, e libera quando há", async () => {
    setEnv({ url: "http://localhost:3000", vercel: null, trustHost: null });
    const request = () =>
      new NextRequest(new URL("/api/posts?filter=following", "http://localhost:3000"));

    mockGetToken.mockResolvedValue(null);
    expect((await proxy(request())).status).toBe(401);

    // Com token, o proxy deixa passar: prova que o 401 acima veio da ausência de
    // sessão e não de um erro qualquer da rota.
    mockGetToken.mockResolvedValue({ sub: "user-1", id: "user-1" });
    const allowed = await proxy(request());
    expect(allowed.status).not.toBe(401);
  });
});
