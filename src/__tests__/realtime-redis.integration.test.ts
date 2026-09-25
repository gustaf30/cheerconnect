// @vitest-environment node
import { Redis } from "@upstash/redis";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const enabled =
  process.env.RUN_REALTIME_TESTS === "true" &&
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

const streamKey =
  process.env.REALTIME_STREAM_KEY || "cheerconnect:test:realtime:default";

describe.skipIf(!enabled)("realtime Redis Streams integration", () => {
  let redis: Redis;
  let bus: typeof import("@/lib/realtime-bus");

  beforeAll(async () => {
    redis = Redis.fromEnv();
    bus = await import("@/lib/realtime-bus");
  });

  afterAll(async () => {
    await redis.del(streamKey).catch(() => {});
  });

  it("writes a published event to the stream", async () => {
    const tail = await bus.getRealtimeStreamTail();
    bus.publishRealtimeEvent({
      userId: "user-1",
      conversationId: "conversation-1",
      type: "message",
    });
    await expect
      .poll(async () => {
        const reply = await redis.xread(streamKey, tail, { count: 10 });
        return JSON.stringify(reply ?? "");
      }, { timeout: 20000 })
      .toContain("conversation-1");

    const entry = JSON.stringify(await redis.xread(streamKey, tail, { count: 10 }));
    expect(entry).toContain("user-1");
    expect(entry).toContain("message");
    expect(entry).toContain("origin");
  });

  it("delivers an event published by another instance", async () => {
    const tail = await bus.getRealtimeStreamTail();

    await redis.xadd(streamKey, "*", {
      user_id: "user-2",
      conversation_id: "conversation-2",
      type: "notification",
      origin: "outra-instancia",
    });

    await expect
      .poll(async () => (await bus.readRealtimeEvents(tail)).events, {
        timeout: 20000,
      })
      .toContainEqual({
        userId: "user-2",
        conversationId: "conversation-2",
        type: "notification",
      });
  });

  it("ignores an event this instance published", async () => {
    const tail = await bus.getRealtimeStreamTail();
    bus.publishRealtimeEvent({ userId: "user-3", type: "notification" });

    // Espera a escrita assíncrona chegar ao stream antes de filtrar.
    await expect
      .poll(
        async () =>
          JSON.stringify((await redis.xread(streamKey, tail, { count: 10 })) ?? ""),
        { timeout: 20000 }
      )
      .toContain("user-3");

    const result = await bus.readRealtimeEvents(tail);
    expect(result.events).toEqual([]);
  });

  it("advances the cursor so an event is never delivered twice", async () => {
    const first = await bus.getRealtimeStreamTail();
    await redis.xadd(streamKey, "*", {
      user_id: "user-4",
      type: "notification",
      origin: "outra-instancia",
    });

    const seen = await expect
      .poll(async () => (await bus.readRealtimeEvents(first)).events, {
        timeout: 20000,
      })
      .toContainEqual({ userId: "user-4", type: "notification" });

    expect(seen).toBeDefined();

    const cursor = (await bus.readRealtimeEvents("0-0")).cursor;
    expect(cursor).not.toBe("0-0");
    const again = await bus.readRealtimeEvents(cursor);
    expect(again.events).toEqual([]);
  });

  it("bounds the stream with exact trim", async () => {
    const key = `${streamKey}:trim-exato`;
    for (let i = 0; i < 60; i++) {
      await redis.xadd(
        key,
        "*",
        { user_id: `user-${i}`, type: "notification" },
        { trim: { type: "MAXLEN", threshold: 10, comparison: "=" } }
      );
    }
    await expect(redis.xlen(key)).resolves.toBe(10);
    await redis.del(key);
  }, 120000);

  it("bounds the stream with approximate trim once it spans several nodes", async () => {
    const key = `${streamKey}:trim`;
    const written = 200;

    for (let i = 0; i < written; i++) {
      await redis.xadd(
        key,
        "*",
        { user_id: `user-${i}`, type: "notification" },
        { trim: { type: "MAXLEN", threshold: 10, comparison: "~" } }
      );
    }

    const length = await redis.xlen(key);
    expect(length).toBeGreaterThan(0);
    // MAXLEN ~ remove nós inteiros, então o resultado fica slightly above the
    // threshold e só age depois que o stream passa de um nó.
    expect(length).toBeLessThan(written);
  }, 180000);

  it("applies an explicit XTRIM to the stream", async () => {
    const key = `${streamKey}:trim-xtrim`;
    for (let i = 0; i < 60; i++) {
      await redis.xadd(key, "*", { user_id: `user-${i}`, type: "notification" });
    }
    await expect(redis.xlen(key)).resolves.toBe(60);

    await redis.xtrim(key, { strategy: "MAXLEN", exactness: "=", threshold: 5 });
    await expect(redis.xlen(key)).resolves.toBe(5);
    await redis.del(key);
  }, 120000);

  it("returns the zero cursor for an empty stream instead of raising", async () => {
    const original = process.env.REALTIME_STREAM_KEY;
    process.env.REALTIME_STREAM_KEY = `${streamKey}:vazia`;
    try {
      // A chave é capturada no load do módulo, então é preciso reimportar.
      vi.resetModules();
      const fresh = await import("@/lib/realtime-bus");
      await expect(fresh.getRealtimeStreamTail()).resolves.toBe("0-0");
      await expect(fresh.readRealtimeEvents("0-0")).resolves.toEqual({
        cursor: "0-0",
        events: [],
      });
    } finally {
      if (original === undefined) delete process.env.REALTIME_STREAM_KEY;
      else process.env.REALTIME_STREAM_KEY = original;
      vi.resetModules();
    }
  });
});
