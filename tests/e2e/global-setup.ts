// Barreira de ambiente do E2E.
//
// O Playwright subia `npm run dev` quando E2E_BASE_URL não estava definido, e o
// dev server herda o DATABASE_URL do `.env` — que é o banco de PRODUÇÃO. A suíte
// tem testes destrutivos; sem esta trava, `npx playwright test` apagaria dado de
// gente real. O `webServer` foi removido do config por isso: a única forma de
// rodar a suíte é apontar para uma base isolada.
//
// A validação fica num globalSetup para valer inclusive para os specs que não
// tocam a fixture de usuário — o guard do fixture só é alcançado por quem chama
// `actor.create` ou `getDb`, e o smoke tem vários testes que não chamam.

import type { FullConfig } from "@playwright/test";

/** Hosts que só podem ser a base de E2E local. */
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function hostOf(value: string | undefined, what: string, prefix: RegExp) {
  if (!value) {
    throw new Error(
      `${what} não está definida. Os E2E são destrutivos e não podem herdar o ` +
        "ambiente do .env.\nRode com `npm run test:e2e`, que sobe a pilha " +
        "isolada (docker-compose.e2e.yml) e define as duas.",
    );
  }
  try {
    return new URL(value.replace(prefix, "https://")).hostname;
  } catch {
    throw new Error(`${what} não é uma URL válida: ${value}`);
  }
}

export default function globalSetup(_config: FullConfig) {
  const appHost = hostOf(process.env.E2E_BASE_URL, "E2E_BASE_URL", /^https?:\/\//);
  if (!ALLOWED_HOSTS.has(appHost)) {
    throw new Error(
      `E2E_BASE_URL aponta para "${appHost}", que não é um host local.`,
    );
  }

  const dbHost = hostOf(process.env.DATABASE_URL, "DATABASE_URL", /^postgres(ql)?:\/\//);
  if (!ALLOWED_HOSTS.has(dbHost)) {
    throw new Error(
      `DATABASE_URL aponta para "${dbHost}", que não é um host local. Recusando ` +
        "rodar: os E2E iriam escrever fora da base isolada.",
    );
  }
}
