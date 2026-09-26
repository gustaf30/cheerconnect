// Fixture de usuários para os E2E destrutivos.
//
// Cada teste recebe contas criadas sob medida, em vez de vir de um pool
// semeado. A razão é o limitador de taxa: a chave é `user:{id}:{pathname}` e o
// teto de /api/posts, /api/teams e /api/events é de 10 por minuto. Se os testes
// em paralelo dividissem um usuário do pool, o limite estouraria e o teste
// falharia por um motivo que não tem nada a ver com o que está sendo verificado.
//
// A conta nasce com emailVerified preenchido porque o registro pela interface
// exige verificação de email, e com EMAIL_PROVIDER=log o token só vai para o
// log do container, onde o teste não consegue alcançá-lo.

// O `use` deste arquivo é a API de fixture do Playwright, não o hook do React, e
// a regra de hooks o rejeita por não reconhecer componentes. Não há componente
// neste arquivo.
/* eslint-disable react-hooks/rules-of-hooks */

import { test as base, type Page, type APIRequestContext } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import process from "node:process";

export type TestUser = {
  id: string;
  email: string;
  username: string;
  password: string;
};

function requireDbUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não definida. Os E2E devem rodar por `npm run test:e2e`, que aponta para a pilha isolada. " +
        "Sem isso os specs escreveriam no banco do .env, que é produção.",
    );
  }
  // Só o host é verificado, e por lista. Um teste de substring casaria com
  // "db-e2e.supabase.co" ou "producao/e2e" e deixaria a trava sem efeito.
  const host = new URL(url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(
      `DATABASE_URL aponta para "${host}", que não é local. Recusando continuar para não escrever fora da pilha isolada.`,
    );
  }
  return url;
}

// Um cliente por processo de worker: o Prisma faz pool e o worker vive mais que
// um teste, então criar e conectar a cada teste só gastaria tempo.
let prisma: PrismaClient | undefined;
let pool: Pool | undefined;

function db() {
  if (!prisma) {
    pool = new Pool({ connectionString: requireDbUrl(), max: 4 });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  }
  return prisma;
}

export function getDb() {
  return db();
}

export async function closeDb() {
  await prisma?.$disconnect().catch(() => {});
  await pool?.end().catch(() => {});
  prisma = undefined;
  pool = undefined;
}

// Sequência por processo: dois testes do mesmo worker nunca colidem, e como o
// sufixo entra no e-mail e no username, nem entre workers diferentes colidem.
let counter = 0;

function uniqueName(prefix: string) {
  counter += 1;
  return `${prefix}_${process.pid.toString(36)}${counter}`;
}

/**
 * Um IP de cliente por teste.
 *
 * O login é a única rota em que o limitador usa IP em vez de usuário, porque no
 * momento do callback ainda não há sessão. Com a suíte inteira rodando em
 * paralelo, são dezenas de logins saindo de `localhost` e o teto de 15/min é
 * estourado — o teste falha por causa do limitador, não do que ele verifica.
 *
 * `getClientIdentifier` em src/lib/middleware-policy.ts lê `x-real-ip` antes de
 * qualquer outra coisa, então cada teste entra com o seu próprio balde. Nenhum
 * código da aplicação muda, e o E2E continua exercitando o limitador de verdade
 * nos testes que verificam limite de taxa.
 *
 * O PID entra no IP porque `counter` é por processo: sem ele, o primeiro teste de
 * cada worker sairia com o mesmo IP e o rate limit voltaria a barrar.
 */
let currentTestIp = "10.0.0.1";

function nextTestIp() {
  counter += 1;
  const pid = process.pid % 60000;
  return `10.${Math.floor(pid / 250) % 250}.${pid % 250}.${(counter % 200) + 20}`;
}

/** Cria um usuário limpo, sem conexão, post, equipe ou evento. */
export async function createUser(label: string): Promise<TestUser> {
  const name = uniqueName(label);
  // bcrypt custo 10 em vez de 12: o hash é descartado no fim do teste, e a
  // diferença economiza cerca de 200 ms por conta criada.
  const password = `Senha-${name}-Aa1`;
  const user = await db().user.create({
    data: {
      email: `${name}@e2e.invalid`,
      username: name,
      name: `E2E ${label}`,
      password: await bcrypt.hash(password, 10),
      emailVerified: new Date(),
    },
    select: { id: true, email: true, username: true },
  });
  return { ...user, password };
}

/** Remove o usuário e tudo que dependa dele, direto no banco. */
export async function deleteUser(id: string) {
  await db().user.deleteMany({ where: { id } });
}

/**
 * Autentica via NextAuth: token de CSRF e depois o callback de credenciais.
 * O cookie fica no contexto de requisição do Playwright, que é o mesmo jar do
 * navegador, então a sessão passa a valer também para `page.goto`.
 *
 * O callback de credenciais é limitado a 15 por minuto **por IP**, e todos os
 * testes saem da mesma máquina. Uma suíte com dezenas de testes estoura essa
 * janela mesmo com um usuário novo por teste, porque a chave do limitador no
 * login ainda é o IP, não o usuário. Em vez de afrouxar o limitador da aplicação
 * — o que mudaria comportamento só para agradar teste — a espera é feita aqui,
 * respeitando o Retry-After. A folga aleatória evita que vários workers esperem
 * o mesmo instante e voltem a colidir juntos.
 */
export async function authenticate(page: Page, user: TestUser) {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const csrfResponse = await page.request.get("/api/auth/csrf");
    const { csrfToken } = await csrfResponse.json();
    const response = await page.request.post("/api/auth/callback/credentials", {
      form: { csrfToken, email: user.email, password: user.password, callbackUrl: "/feed", json: "true" },
      headers: { "Content-Type": "application/x-www-form-urlencoded", "x-real-ip": currentTestIp },
      maxRedirects: 0,
    });

    if (response.ok()) return user;

    if (response.status() === 429 && attempt < maxAttempts) {
      const retryAfter = Number(response.headers()["retry-after"] ?? 5);
      const waitMs = Math.min(retryAfter + 1, 65) * 1000 + Math.floor(Math.random() * 2000);
      await page.waitForTimeout(waitMs);
      continue;
    }

    throw new Error(
      `login falhou para ${user.email} (status ${response.status()}${attempt < maxAttempts ? "" : ", após espera pela janela de taxa"})`,
    );
  }
  throw new Error(`login falhou para ${user.email}`);
}

/**
 * Tenta um login e devolve o status final, esperando a janela de taxa quando
 * preciso.
 *
 * Existe para o caso em que o login é o que está sob teste: a rota de
 * credenciais é limitada a 15/min por IP, então um 429 aqui seria sobre o
 * limitador e não sobre a credencial. `authenticate` acima faz o mesmo, mas
 * lança em vez de devolver o status.
 */
export async function loginStatus(
  request: APIRequestContext,
  user: TestUser,
  maxAttempts = 4,
): Promise<number> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const csrfResponse = await request.get("/api/auth/csrf");
    const { csrfToken } = await csrfResponse.json();
    const response = await request.post("/api/auth/callback/credentials", {
      form: {
        csrfToken,
        email: user.email,
        password: user.password,
        callbackUrl: "/feed",
        json: "true",
      },
      headers: { "Content-Type": "application/x-www-form-urlencoded", "x-real-ip": currentTestIp },
      maxRedirects: 0,
    });
    if (response.status() !== 429 || attempt === maxAttempts) return response.status();
    const retryAfter = Number(response.headers()["retry-after"] ?? 5);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(retryAfter + 1, 65) * 1000 + Math.floor(Math.random() * 2000)),
    );
  }
  return 429;
}
/**
 * Usuários criados durante o teste, removidos no fim.
 *
 * A limpeza usa `deleteMany`, que é idempotente: o teste que apaga a própria
 * conta pela aplicação não gera erro aqui, porque não sobrou linha nenhuma.
 */
export type ActorFactory = {
  create: (label?: string) => Promise<TestUser>;
};

export const test = base.extend<{ actor: ActorFactory }>({
  actor: async ({}, use) => {
    currentTestIp = nextTestIp();
    const created: TestUser[] = [];

    await use({
      async create(label = "u") {
        const user = await createUser(label);
        created.push(user);
        return user;
      },
    });

    for (const user of created) {
      await deleteUser(user.id).catch(() => {});
    }
  },
});

export const expect = test.expect;
