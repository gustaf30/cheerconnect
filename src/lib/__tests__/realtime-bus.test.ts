import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const xadd = vi.fn();
const xread = vi.fn();
const xrevrange = vi.fn();

const fakeRedis = { xadd, xread, xrevrange };

let redisInstance: typeof fakeRedis | null = fakeRedis;

vi.mock("@/lib/redis", () => ({
  isRedisConfigured: true,
  getRedis: () => redisInstance,
}));

type Bus = typeof import("@/lib/realtime-bus");

const ENV_KEYS = [
  "REALTIME_BUS_TRANSPORT",
  "REALTIME_SIGNAL_INTERVAL_MS",
  "REALTIME_STREAM_KEY",
];

async function loadBus(
  env: Record<string, string | undefined> = {}
): Promise<Bus> {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) process.env[key] = value;
  }
  const globals = globalThis as Record<string, unknown>;
  delete globals.cheerconnectRealtimePump;
  vi.resetModules();
  return import("@/lib/realtime-bus");
}

function streamEntry(
  id: string,
  fields: Record<string, string>
): [string, string[]] {
  return [id, Object.entries(fields).flat()];
}

function xreadReply(entries: unknown[]): unknown[] {
  return [["cheerconnect:realtime", entries]];
}

beforeEach(() => {
  redisInstance = fakeRedis;
  xadd.mockReset().mockResolvedValue("1-0");
  xread.mockReset().mockResolvedValue(null);
  xrevrange.mockReset().mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("realtime bus", () => {
  it("delivers events to subscribers and stops after unsubscribe", async () => {
    const bus = await loadBus({ REALTIME_BUS_TRANSPORT: "memory" });
    const listener = vi.fn();
    const unsubscribe = bus.subscribeRealtimeEvents(listener);
    bus.publishRealtimeEvent({ userId: "user-1", type: "notification" });
    unsubscribe();
    bus.publishRealtimeEvent({
      userId: "user-1",
      type: "message",
      conversationId: "conversation-1",
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      userId: "user-1",
      type: "notification",
    });
  });

  it("falls back to memory when Redis is unavailable", async () => {
    redisInstance = null;
    const bus = await loadBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribeRealtimeEvents(listener);
    expect(bus.getRealtimeTransport()).toBe("memory");
    bus.publishRealtimeEvent({ userId: "user-1", type: "notification" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(xadd).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("defaults to the redis transport when a client is available", async () => {
    const bus = await loadBus();
    expect(bus.getRealtimeTransport()).toBe("redis");
  });

  it("appends to the stream with a MAXLEN trim and emits locally", async () => {
    const bus = await loadBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribeRealtimeEvents(listener);
    bus.publishRealtimeEvent({
      userId: "user-1",
      conversationId: "conversation-9",
      type: "message",
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(xadd).toHaveBeenCalledTimes(1);
    const [key, id, fields, options] = xadd.mock.calls[0];
    expect(key).toBe("cheerconnect:realtime");
    expect(id).toBe("*");
    expect(fields).toMatchObject({
      user_id: "user-1",
      conversation_id: "conversation-9",
      type: "message",
    });
    expect(fields).toHaveProperty("origin");
    expect(options).toEqual({
      trim: { type: "MAXLEN", threshold: 1000, comparison: "~" },
    });
    unsubscribe();
  });

  it("does not write to the stream when the transport is memory", async () => {
    const bus = await loadBus({ REALTIME_BUS_TRANSPORT: "memory" });
    const unsubscribe = bus.subscribeRealtimeEvents(vi.fn());
    bus.publishRealtimeEvent({ userId: "user-1", type: "notification" });
    expect(xadd).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("never throws when the stream write fails", async () => {
    xadd.mockRejectedValue(new Error("redis down"));
    const bus = await loadBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribeRealtimeEvents(listener);
    expect(() =>
      bus.publishRealtimeEvent({ userId: "user-1", type: "notification" })
    ).not.toThrow();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("reads new entries and advances the cursor to the last id", async () => {
    xread.mockResolvedValue(
      xreadReply([
        streamEntry("5-0", { user_id: "user-1", type: "notification" }),
        streamEntry("6-0", {
          user_id: "user-2",
          conversation_id: "conversation-1",
          type: "message",
        }),
      ])
    );
    const bus = await loadBus();
    const result = await bus.readRealtimeEvents("4-0");
    expect(xread).toHaveBeenCalledWith(
      "cheerconnect:realtime",
      "4-0",
      expect.objectContaining({ count: 100 })
    );
    expect(result.cursor).toBe("6-0");
    expect(result.events).toEqual([
      { userId: "user-1", type: "notification" },
      { userId: "user-2", conversationId: "conversation-1", type: "message" },
    ]);
  });

  it("keeps the cursor when there is nothing new", async () => {
    const bus = await loadBus();
    const result = await bus.readRealtimeEvents("7-0");
    expect(result).toEqual({ cursor: "7-0", events: [] });
  });

  it("keeps the cursor and does not throw when the read fails", async () => {
    xread.mockRejectedValue(new Error("redis down"));
    const bus = await loadBus();
    await expect(bus.readRealtimeEvents("8-0")).resolves.toEqual({
      cursor: "8-0",
      events: [],
    });
  });

  it("does not read the stream in memory mode", async () => {
    const bus = await loadBus({ REALTIME_BUS_TRANSPORT: "memory" });
    await bus.readRealtimeEvents("0-0");
    await bus.getRealtimeStreamTail();
    expect(xread).not.toHaveBeenCalled();
    expect(xrevrange).not.toHaveBeenCalled();
  });

  it("drops malformed entries and unknown types", async () => {
    xread.mockResolvedValue(
      xreadReply([
        ["9-0", ["user_id", "user-1", "type", "bogus"]],
        streamEntry("10-0", { type: "notification" }),
        ["not-an-entry"],
      ])
    );
    const bus = await loadBus();
    const result = await bus.readRealtimeEvents("0-0");
    expect(result.events).toEqual([]);
    // O cursor avança até a última entrada interpretável para não reler as
    // entradas malformadas indefinidamente.
    expect(result.cursor).toBe("10-0");
  });

  it("ignores entries this instance published", async () => {
    const bus = await loadBus();
    bus.publishRealtimeEvent({ userId: "user-1", type: "notification" });
    const origin = xadd.mock.calls[0][2].origin;
    xread.mockResolvedValue(
      xreadReply([
        streamEntry("11-0", {
          user_id: "user-1",
          type: "notification",
          origin,
        }),
      ])
    );
    const result = await bus.readRealtimeEvents("0-0");
    expect(result.events).toEqual([]);
  });

  it("reads the stream tail from the object shape the client returns", async () => {
    xrevrange.mockResolvedValue({ "42-0": { user_id: "user-1" } });
    const bus = await loadBus();
    await expect(bus.getRealtimeStreamTail()).resolves.toBe("42-0");
    expect(xrevrange).toHaveBeenCalledWith("cheerconnect:realtime", "+", "-", 1);
  });

  it("reads the stream tail from raw and array shapes", async () => {
    const bus = await loadBus();
    xrevrange.mockResolvedValue([["43-0", ["user_id", "user-1"]]]);
    await expect(bus.getRealtimeStreamTail()).resolves.toBe("43-0");
    xrevrange.mockResolvedValue([{ "44-0": { user_id: "user-1" } }]);
    await expect(bus.getRealtimeStreamTail()).resolves.toBe("44-0");
  });

  it("returns the zero cursor when the stream is empty or unreadable", async () => {
    const bus = await loadBus();
    xrevrange.mockResolvedValue({});
    await expect(bus.getRealtimeStreamTail()).resolves.toBe("0-0");
    xrevrange.mockResolvedValue(null);
    await expect(bus.getRealtimeStreamTail()).resolves.toBe("0-0");
    xrevrange.mockRejectedValue(new Error("redis down"));
    await expect(bus.getRealtimeStreamTail()).resolves.toBe("0-0");
  });

  it("delivers cross-instance events through the signal pump", async () => {
    vi.useFakeTimers();
    xrevrange.mockResolvedValue({});
    xread.mockResolvedValue(
      xreadReply([
        streamEntry("20-0", {
          user_id: "user-1",
          type: "message",
          conversation_id: "conversation-1",
          origin: "outra-instancia",
        }),
      ])
    );

    const bus = await loadBus({ REALTIME_SIGNAL_INTERVAL_MS: "250" });
    const listener = vi.fn();
    const unsubscribe = bus.subscribeRealtimeEvents(listener);

    await vi.advanceTimersByTimeAsync(600);

    expect(listener).toHaveBeenCalledWith({
      userId: "user-1",
      conversationId: "conversation-1",
      type: "message",
    });
    unsubscribe();
  });
});
