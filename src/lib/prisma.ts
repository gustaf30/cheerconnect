import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  // O teto de conexões é o principal gargalo de vazão sob carga: com 10, as
  // requisições enfileiram no pool antes de chegar ao Postgres.
  const parsedMax = Number(process.env.DATABASE_POOL_MAX);
  const max = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 10;

  const pool = new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    ...(process.env.NODE_ENV !== "production" && { log: ["warn" as const] }),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
