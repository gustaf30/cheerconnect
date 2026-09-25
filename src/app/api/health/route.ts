import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
import logger from "@/lib/logger";

const REDIS_TIMEOUT_MS = 1500;

type RedisHealth = "ok" | "unavailable" | "not_configured";

// Redis não é dependência crítica: o realtime cai para o EventEmitter local e o
// rate limit cai para o contador em memória. Por isso isso não muda o status
// HTTP, apenas torna a degradação visível.
async function checkRedis(): Promise<RedisHealth> {
  const redis = getRedis();
  if (!redis) return "not_configured";

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("redis timeout")), REDIS_TIMEOUT_MS);
      }),
    ]);
    return "ok";
  } catch {
    return "unavailable";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "ok",
      redis: await checkRedis(),
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error({ err: error }, "Health check failed");
    return NextResponse.json({
      status: "error",
      database: "error",
      redis: await checkRedis(),
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
