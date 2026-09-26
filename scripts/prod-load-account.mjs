// Conta de carga para a Medição B (latência em produção).
//
// A Medição B precisa de uma sessão autenticada contra a Vercel, e o k6 não tem
// como criar conta sozinho. Este script cria uma conta dedicada, marcada para
// reconhecimento, e a remove no fim. É a execução mais próxima de "escrever em
// produção" do projeto, então o escopo é deliberadamente mínimo:
//
//   - uma conta, sem posts, sem conexões, sem equipe
//   - e-mail em .invalid, domínio reservado que não pode existir de verdade
//   - nenhuma escrita de conteúdo, nenhum dado de usuário real tocado
//   - remoção no passo `delete`, com verificação posterior
//
//   node scripts/prod-load-account.mjs create
//   node scripts/prod-load-account.mjs delete
//   node scripts/prod-load-account.mjs status

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import process from "node:process";

const EMAIL = process.env.PROD_LOAD_EMAIL || "carga0@load.invalid";
const USERNAME = process.env.PROD_LOAD_USERNAME || "carga_prod_0";
const PASSWORD = process.env.PROD_LOAD_PASSWORD || "Carga-prod-123";
const action = process.argv[2] || "status";

/**
 * Trava de segurança.
 *
 * Este é o único script do projeto que escreve no banco de produção, e a remoção
 * é irreversível: `user.delete` cascateia para tudo que o usuário produziu. O
 * e-mail em domínio reservado é a garantia de que a conta é de teste, mas
 * `PROD_LOAD_EMAIL` é sobrescrevível pelo ambiente — então a garantia é
 * verificada, não presumida.
 */
function assertTestAccount() {
  if (!EMAIL.endsWith(".invalid")) {
    throw new Error(
      `PROD_LOAD_EMAIL="${EMAIL}" não está em domínio reservado (.invalid). ` +
        "Este script só pode criar e apagar contas de teste; um e-mail real " +
        "seria removido em cascata.",
    );
  }
  if (USERNAME.length > 0 && !USERNAME.startsWith("carga_prod_")) {
    throw new Error(
      `PROD_LOAD_USERNAME="${USERNAME}" não segue o prefixo carga_prod_ usado ` +
        "para marcar conta de teste.",
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não definida; recusando tocar em banco desconhecido.");
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function status() {
  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { email: true, username: true, createdAt: true },
  });
  console.log(
    user
      ? `existe: ${user.email} (${user.username}) desde ${user.createdAt.toISOString()}`
      : "nao existe",
  );
  return 0;
}

async function create() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL }, select: { email: true } });
  if (existing) {
    console.log("ja existe; nada a fazer");
    return 0;
  }

  const password = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      username: USERNAME,
      name: "Conta de carga",
      password,
      // Sem verificação o login seria recusado, e o e-mail de verificação
      // disparado de verdade para um domínio inexistente não é aceitável.
      emailVerified: new Date(),
    },
    select: { email: true, username: true },
  });
  console.log(`criada: ${user.email} (${user.username})`);
  return 0;
}

async function remove() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
  if (!existing) {
    console.log("nao existe; nada a remover");
    return 0;
  }
  // As cascading deletes do schema removem o que depender dessa conta.
  await prisma.user.delete({ where: { id: existing.id } });
  await status();
  return 0;
}

const actions = { create, delete: remove, status };

try {
  assertTestAccount();
  const handler = actions[action];
  if (!handler) {
    console.error(`acao invalida: ${action} (use create, delete ou status)`);
    process.exitCode = 1;
  } else {
    process.exitCode = await handler();
  }
} catch (error) {
  console.error("ERRO:", error.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
}
