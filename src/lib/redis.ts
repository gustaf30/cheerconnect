import { Redis } from "@upstash/redis";

// Avaliado no load do módulo para preservar a semântica de inlining de env
// que o Edge Runtime já usava em src/proxy.ts.
export const isRedisConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

let cached: Redis | null | undefined;

/**
 * Cliente Redis compartilhado. Retorna `null` quando as credenciais não
 * existem ou quando a construção do cliente falha, para que cada consumidor
 * possa degradar para o comportamento local.
 */
export function getRedis(): Redis | null {
  if (cached !== undefined) return cached;
  if (!isRedisConfigured) {
    cached = null;
    return cached;
  }
  try {
    cached = Redis.fromEnv({
      // O padrão do cliente é 5 retries com backoff exponencial, o que custava
      // cerca de 4,3 s por requisição quando o Redis estava fora. Como o
      // realtime e o rate limit já caem para o caminho local, o certo é falhar
      // rápido: um retry curto absorve falha transitória e o resto degrada na
      // hora em vez de segurar a requisição.
      retry: { retries: 1, backoff: (attempt) => Math.min(50 * 2 ** attempt, 200) },
    });
  } catch {
    cached = null;
  }
  return cached;
}
