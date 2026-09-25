import { EventEmitter } from "node:events";
import { getRedis } from "@/lib/redis";

export type RealtimeEvent = {
  userId: string;
  conversationId?: string;
  type: "message" | "notification";
};

export type RealtimeTransport = "memory" | "redis";

const STREAM_KEY = process.env.REALTIME_STREAM_KEY || "cheerconnect:realtime";
const STREAM_READ_COUNT = 100;
const DEFAULT_SIGNAL_INTERVAL_MS = 2000;
const MIN_SIGNAL_INTERVAL_MS = 250;
const DEFAULT_STREAM_MAXLEN = 1000;
const MIN_STREAM_MAXLEN = 10;

function streamMaxLen(): number {
  const parsed = Number(process.env.REALTIME_STREAM_MAXLEN);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_STREAM_MAXLEN;
  return Math.max(MIN_STREAM_MAXLEN, parsed);
}

type StreamEntry = { id: string; fields: Record<string, string> };

const globalForRealtime = globalThis as typeof globalThis & {
  cheerconnectRealtime?: EventEmitter;
  cheerconnectRealtimeInstanceId?: string;
  cheerconnectRealtimePump?: { started: boolean; cursor: string; pumping: boolean };
};

const emitter = globalForRealtime.cheerconnectRealtime ?? new EventEmitter();
emitter.setMaxListeners(1000);
globalForRealtime.cheerconnectRealtime = emitter;

const instanceId =
  globalForRealtime.cheerconnectRealtimeInstanceId ??
  (globalForRealtime.cheerconnectRealtimeInstanceId = Math.random()
    .toString(36)
    .slice(2));

const pump = (globalForRealtime.cheerconnectRealtimePump ??= {
  started: false,
  cursor: "0-0",
  pumping: false,
});

export function getRealtimeTransport(): RealtimeTransport {
  const configured = process.env.REALTIME_BUS_TRANSPORT;
  if (configured === "memory") return "memory";
  if (configured === "redis") return "redis";
  return getRedis() ? "redis" : "memory";
}

function signalIntervalMs(): number {
  const parsed = Number(process.env.REALTIME_SIGNAL_INTERVAL_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SIGNAL_INTERVAL_MS;
  return Math.max(MIN_SIGNAL_INTERVAL_MS, parsed);
}

async function appendRealtimeEvent(event: RealtimeEvent): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.xadd(
      STREAM_KEY,
      "*",
      {
        user_id: event.userId,
        conversation_id: event.conversationId ?? "",
        type: event.type,
        origin: instanceId,
      },
      { trim: { type: "MAXLEN", threshold: streamMaxLen(), comparison: "~" } }
    );
  } catch {
    // Realtime é apenas otimização de latência: uma falha do Redis nunca pode
    // derrubar a requisição de escrita que originou o evento.
  }
}

export function publishRealtimeEvent(event: RealtimeEvent): void {
  emitter.emit("event", event);
  if (getRealtimeTransport() === "redis") void appendRealtimeEvent(event);
}

export function subscribeRealtimeEvents(
  listener: (event: RealtimeEvent) => void
): () => void {
  ensureSignalPump();
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}

export async function getRealtimeStreamTail(): Promise<string> {
  const redis = getRedis();
  if (!redis || getRealtimeTransport() !== "redis") return "0-0";
  try {
    return extractLastEntryId(await redis.xrevrange(STREAM_KEY, "+", "-", 1));
  } catch {
    return "0-0";
  }
}

export async function readRealtimeEvents(
  sinceId: string
): Promise<{ cursor: string; events: RealtimeEvent[] }> {
  const unchanged = { cursor: sinceId, events: [] as RealtimeEvent[] };
  const redis = getRedis();
  if (!redis || getRealtimeTransport() !== "redis") return unchanged;
  try {
    const reply = await redis.xread(STREAM_KEY, sinceId, {
      count: STREAM_READ_COUNT,
    });
    const entries = parseStreamReply(reply);
    if (entries.length === 0) return unchanged;
    const events = entries
      .map(parseStreamEvent)
      .filter((event): event is RealtimeEvent => event !== null);
    return { cursor: entries[entries.length - 1].id, events };
  } catch {
    return unchanged;
  }
}

function ensureSignalPump(): void {
  if (pump.started) return;
  pump.started = true;
  if (getRealtimeTransport() !== "redis") return;
  void getRealtimeStreamTail().then((tail) => {
    pump.cursor = tail;
    const timer = setInterval(() => void pumpOnce(), signalIntervalMs());
    timer.unref?.();
  });
}

async function pumpOnce(): Promise<void> {
  if (pump.pumping) return;
  pump.pumping = true;
  try {
    const { cursor, events } = await readRealtimeEvents(pump.cursor);
    pump.cursor = cursor;
    for (const event of events) emitter.emit("event", event);
  } catch {
    // Um erro isolado não deve parar o pump; o cursor só avança em leituras
    // bem-sucedidas, então nada é perdido.
  } finally {
    pump.pumping = false;
  }
}

// XREVRANGE com COUNT 1 devolve a última entrada, mas o formato varia entre o
// cliente real e tipos genéricos do SDK: um objeto indexado pelo id, um array
// desses objetos ou a forma crua [[id, [campo, valor, ...]]].
function extractLastEntryId(reply: unknown): string {
  if (!reply) return "0-0";
  if (Array.isArray(reply)) {
    for (const item of reply) {
      if (Array.isArray(item) && typeof item[0] === "string") return item[0];
      if (item && typeof item === "object") {
        const id = Object.keys(item as Record<string, unknown>)[0];
        if (id) return id;
      }
    }
    return "0-0";
  }
  if (typeof reply === "object") {
    return Object.keys(reply as Record<string, unknown>)[0] ?? "0-0";
  }
  return "0-0";
}

function parseStreamReply(reply: unknown): StreamEntry[] {
  if (!Array.isArray(reply)) return [];
  const entries: StreamEntry[] = [];
  for (const stream of reply) {
    if (!Array.isArray(stream)) continue;
    const rawEntries = stream[1];
    if (!Array.isArray(rawEntries)) continue;
    for (const entry of rawEntries) {
      if (!Array.isArray(entry)) continue;
      const [id, pairs] = entry;
      if (typeof id !== "string" || !Array.isArray(pairs)) continue;
      const fields: Record<string, string> = {};
      for (let i = 0; i + 1 < pairs.length; i += 2) {
        const key = pairs[i];
        if (typeof key === "string") fields[key] = String(pairs[i + 1] ?? "");
      }
      entries.push({ id, fields });
    }
  }
  return entries;
}

function parseStreamEvent(entry: StreamEntry): RealtimeEvent | null {
  const { user_id: userId, type, conversation_id: conversationId, origin } =
    entry.fields;
  if (!userId) return null;
  if (type !== "message" && type !== "notification") return null;
  if (origin === instanceId) return null;
  return conversationId ? { userId, conversationId, type } : { userId, type };
}
