// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockSession } from "@/test/api-helpers";

const { mockPrisma, mockGetServerSession, mockSubscribe } = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    mockPrisma: {
      user: { findUnique: fn() },
      notification: { count: fn() },
      message: { count: fn(), findFirst: fn(), findMany: fn(), updateMany: fn() },
      conversation: { findFirst: fn(), findUnique: fn() },
      block: { findFirst: fn(), findMany: fn() },
    },
    mockGetServerSession: fn(),
    // Devolve a função de cancelamento, que a rota chama no close().
    mockSubscribe: fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: (...args: unknown[]) => mockGetServerSession(...args) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/realtime-bus", () => ({ subscribeRealtimeEvents: mockSubscribe }));

import { GET as NOTIFICATIONS_STREAM } from "@/app/api/notifications/stream/route";
import { GET as MESSAGES_STREAM } from "@/app/api/conversations/[id]/messages/stream/route";

const CONVERSATION_ID = "conv-1";
const conversationParams = { params: Promise.resolve({ id: CONVERSATION_ID }) };

/** Sessão com tokenVersion, para exercitar a invalidação de sessão. */
const sessionWithToken = mockSession({ user: { id: "u1", name: "Test", email: "t@e.com", username: "t", tokenVersion: 3 } } as never);

function makeRequest(url: string) {
  const controller = new AbortController();
  return { request: new Request(url, { signal: controller.signal }), abort: () => controller.abort() };
}

/** Lê quadros do stream até `matcher` casar, ou lança se o stream fechar antes. */
async function readUntil(response: Response, matcher: RegExp, limit = 8) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (let i = 0; i < limit; i += 1) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (matcher.test(buffer)) return buffer;
    }
  } finally {
    reader.releaseLock();
  }
  throw new Error(`stream terminou sem casar ${matcher}. Lido: ${JSON.stringify(buffer)}`);
}

describe("GET /api/notifications/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(sessionWithToken);
    mockSubscribe.mockReturnValue(() => {});
    mockPrisma.block.findMany.mockResolvedValue([]);
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 3, emailVerified: true });
    mockPrisma.notification.count.mockResolvedValue(2);
    mockPrisma.message.count.mockResolvedValue(1);
    mockPrisma.conversation.findFirst.mockResolvedValue({ lastMessageAt: new Date("2026-09-26T12:00:00.000Z") });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await NOTIFICATIONS_STREAM(new Request("http://localhost/api/notifications/stream"));

    expect(response.status).toBe(401);
    expect(mockPrisma.notification.count).not.toHaveBeenCalled();
  });

  it("opens an event stream with the headers that disable proxy buffering", async () => {
    const { request, abort } = makeRequest("http://localhost/api/notifications/stream");

    const response = await NOTIFICATIONS_STREAM(request);
    abort();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    // Sem estes dois, um proxy no meio engoliria o stream e o cliente ficaria
    // esperando dado que nunca chega.
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache, no-transform");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");
  });

  it("sends the retry hint before any data, as the SSE contract requires", async () => {
    const { request, abort } = makeRequest("http://localhost/api/notifications/stream");

    const response = await NOTIFICATIONS_STREAM(request);
    const buffer = await readUntil(response, /data: /);
    abort();

    expect(buffer.startsWith("retry: 5000\n\n")).toBe(true);
  });

  it("publishes notification and message counts on the first poll", async () => {
    const { request, abort } = makeRequest("http://localhost/api/notifications/stream");

    const response = await NOTIFICATIONS_STREAM(request);
    const buffer = await readUntil(response, /"notificationCount"/);
    abort();

    const frame = JSON.parse(buffer.match(/data: (.+)/)![1]);
    expect(frame).toEqual({
      notificationCount: 2,
      messageCount: 1,
      lastMessageAt: "2026-09-26T12:00:00.000Z",
    });
  });

  it("excludes messages from the user themself and from blocked users", async () => {
    // getBlockedUserIds é chamado duas vezes: uma ao abrir o stream e outra a
    // cada sondagem. A resposta precisa valer para toda invocação, senão a
    // segunda volta vazia e o filtro some justo na contagem.
    mockPrisma.block.findMany.mockImplementation(({ where }: { where: { userId?: string; blockedUserId?: string } }) =>
      Promise.resolve(
        where.userId ? [{ blockedUserId: "u9" }] : [{ userId: "u8" }],
      ),
    );
    const { request, abort } = makeRequest("http://localhost/api/notifications/stream");

    const response = await NOTIFICATIONS_STREAM(request);
    await readUntil(response, /"notificationCount"/);
    abort();

    const where = mockPrisma.message.count.mock.calls[0][0].where;
    // A ordem é a de getBlockedUserIds: primeiro quem eu bloqueei, depois quem
    // me bloqueou.
    expect(where.senderId).toEqual({ notIn: ["u1", "u9", "u8"] });
    const notifWhere = mockPrisma.notification.count.mock.calls[0][0].where;
    expect(notifWhere.actorId).toEqual({ notIn: ["u9", "u8"] });
    // A contagem de notificações não é notificação de mensagem: a mesma
    // informação já vem no campo messageCount, e somar as duas duplicaria.
    expect(notifWhere.type).toEqual({ not: "MESSAGE_RECEIVED" });
  });

  it("emits a heartbeat instead of data when nothing changed", async () => {
    vi.useFakeTimers();
    const { request, abort } = makeRequest("http://localhost/api/notifications/stream");

    const response = await NOTIFICATIONS_STREAM(request);
    await readUntil(response, /"notificationCount"/);
    // Dispara o segundo poll com as mesmas contagens: nada mudou, então o
    // keep-alive precisa manter a conexão viva sem enviar payload.
    await vi.advanceTimersByTimeAsync(30_000);
    const buffer = await readUntil(response, /: heartbeat/);
    abort();

    expect(buffer).toContain(": heartbeat");
  });

  it("closes the stream when the session token is no longer valid", async () => {
    vi.useFakeTimers();
    // A sessão precisa valer na abertura e ficar inválida na sondagem seguinte.
    // requireAuth também consulta o tokenVersion, então invalidar logo de cara
    // devolveria 401 e nunca abriria o stream.
    // A sessão vale na abertura (requireAuth) e na primeira sondagem, que é a
    // que emite o primeiro quadro; a segunda encontra o token invalidado e
    // fecha o stream.
    let calls = 0;
    mockPrisma.user.findUnique.mockImplementation(() => {
      calls += 1;
      return Promise.resolve(
        calls <= 2 ? { tokenVersion: 3, emailVerified: true } : { tokenVersion: 99, emailVerified: true },
      );
    });
    const { request, abort } = makeRequest("http://localhost/api/notifications/stream");

    const response = await NOTIFICATIONS_STREAM(request);
    await readUntil(response, /"notificationCount"/);
    // Deixa start() terminar e registrar o intervalo antes de avançar o relógio.
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);

    // O stream precisa terminar, não ficar pendurado: é assim que a invalidação
    // global de sessão desconecta quem foi deslogado em outro lugar.
    const reader = response.body!.getReader();
    let done = false;
    for (let i = 0; i < 5 && !done; i += 1) {
      done = (await reader.read()).done;
    }
    reader.releaseLock();
    abort();

    expect(done).toBe(true);
    expect(calls).toBeGreaterThan(1);
  });

  it("unsubscribes from the bus when the client disconnects", async () => {
    const unsubscribe = vi.fn();
    mockSubscribe.mockReturnValue(unsubscribe);
    const { request, abort } = makeRequest("http://localhost/api/notifications/stream");

    const response = await NOTIFICATIONS_STREAM(request);
    await readUntil(response, /"notificationCount"/);
    abort();
    await vi.waitFor(() => expect(unsubscribe).toHaveBeenCalled());
  });

  it("polls slower when the tab is hidden", async () => {
    vi.useFakeTimers();
    const visible = makeRequest("http://localhost/api/notifications/stream");
    const responseVisible = await NOTIFICATIONS_STREAM(visible.request);
    await readUntil(responseVisible, /"notificationCount"/);
    // start() registra o intervalo logo depois da primeira sondagem; sem este
    // flush o relógio avança antes do setInterval existir.
    await vi.advanceTimersByTimeAsync(0);
    const visibleCalls = mockPrisma.notification.count.mock.calls.length;
    await vi.advanceTimersByTimeAsync(29_000);
    expect(mockPrisma.notification.count.mock.calls.length).toBe(visibleCalls);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mockPrisma.notification.count.mock.calls.length).toBe(visibleCalls + 1);
    visible.abort();

    mockPrisma.notification.count.mockClear();
    const idle = makeRequest("http://localhost/api/notifications/stream?idle=true");
    const responseIdle = await NOTIFICATIONS_STREAM(idle.request);
    await readUntil(responseIdle, /"notificationCount"/);
    await vi.advanceTimersByTimeAsync(0);
    const idleInitial = mockPrisma.notification.count.mock.calls.length;
    await vi.advanceTimersByTimeAsync(59_000);
    // Mesmo tempo que dispararia duas sondagens com a aba visível; em idle é uma.
    expect(mockPrisma.notification.count.mock.calls.length).toBe(idleInitial);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mockPrisma.notification.count.mock.calls.length).toBe(idleInitial + 1);
    idle.abort();
  });
});

describe("GET /api/conversations/[id]/messages/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(sessionWithToken);
    mockSubscribe.mockReturnValue(() => {});
    mockPrisma.block.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 3, emailVerified: true });
    mockPrisma.message.findFirst.mockResolvedValue(null);
    mockPrisma.message.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await MESSAGES_STREAM(
      new Request(`http://localhost/api/conversations/${CONVERSATION_ID}/messages/stream`),
      conversationParams,
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when the conversation does not exist", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue(null);

    const response = await MESSAGES_STREAM(
      new Request(`http://localhost/api/conversations/${CONVERSATION_ID}/messages/stream`),
      conversationParams,
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.message.findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 for a third party who is not a participant", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: CONVERSATION_ID,
      participant1Id: "outro",
      participant2Id: "outro2",
    });

    const response = await MESSAGES_STREAM(
      new Request(`http://localhost/api/conversations/${CONVERSATION_ID}/messages/stream`),
      conversationParams,
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when the other party blocked the viewer", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: CONVERSATION_ID,
      participant1Id: "u1",
      participant2Id: "u2",
    });
    mockPrisma.block.findFirst.mockResolvedValue({ id: "b1" });

    const response = await MESSAGES_STREAM(
      new Request(`http://localhost/api/conversations/${CONVERSATION_ID}/messages/stream`),
      conversationParams,
    );

    expect(response.status).toBe(404);
  });

  it("opens an event stream and announces the retry interval", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: CONVERSATION_ID,
      participant1Id: "u1",
      participant2Id: "u2",
    });
    const { request, abort } = makeRequest(
      `http://localhost/api/conversations/${CONVERSATION_ID}/messages/stream`,
    );

    const response = await MESSAGES_STREAM(request, conversationParams);
    const buffer = await readUntil(response, /retry: 5000/);
    abort();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(buffer.startsWith("retry: 5000")).toBe(true);
  });

  it("publishes new messages with the last id, so the client can resume", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: CONVERSATION_ID,
      participant1Id: "u1",
      participant2Id: "u2",
    });
    mockPrisma.message.findMany.mockResolvedValue([
      { id: "m1", senderId: "u2", content: "oi", isRead: false, createdAt: new Date("2026-09-26T12:00:00.000Z") },
    ]);
    const { request, abort } = makeRequest(
      `http://localhost/api/conversations/${CONVERSATION_ID}/messages/stream`,
    );

    const response = await MESSAGES_STREAM(request, conversationParams);
    const buffer = await readUntil(response, /new_messages/);
    abort();

    // O id no quadro é o que permite retomar depois de queda sem repetir nem
    // perder mensagem entre as duas sondagens.
    expect(buffer).toContain("id: m1");
    const frame = JSON.parse(buffer.match(/data: (.+)/)![1]);
    expect(frame.type).toBe("new_messages");
    expect(frame.messages).toHaveLength(1);
  });

  it("marks incoming messages as read without touching what the viewer sent", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: CONVERSATION_ID,
      participant1Id: "u1",
      participant2Id: "u2",
    });
    mockPrisma.message.findMany.mockResolvedValue([
      { id: "m1", senderId: "u2", content: "oi", isRead: false, createdAt: new Date() },
    ]);
    const { request, abort } = makeRequest(
      `http://localhost/api/conversations/${CONVERSATION_ID}/messages/stream`,
    );

    const response = await MESSAGES_STREAM(request, conversationParams);
    await readUntil(response, /new_messages/);
    abort();

    expect(mockPrisma.message.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ senderId: { not: "u1" } }) }),
    );
  });

  it("does not mark as read when the only new message is from the viewer", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: CONVERSATION_ID,
      participant1Id: "u1",
      participant2Id: "u2",
    });
    mockPrisma.message.findMany.mockResolvedValue([
      { id: "m1", senderId: "u1", content: "eu", isRead: true, createdAt: new Date() },
    ]);
    const { request, abort } = makeRequest(
      `http://localhost/api/conversations/${CONVERSATION_ID}/messages/stream`,
    );

    const response = await MESSAGES_STREAM(request, conversationParams);
    await readUntil(response, /new_messages/);
    abort();

    expect(mockPrisma.message.updateMany).not.toHaveBeenCalled();
  });

  it("resumes from the last-event-id header instead of the newest message", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: CONVERSATION_ID,
      participant1Id: "u1",
      participant2Id: "u2",
    });
    mockPrisma.message.findFirst.mockResolvedValue({
      id: "m50",
      createdAt: new Date("2026-09-26T11:00:00.000Z"),
    });
    const controller = new AbortController();
    const request = new Request(
      `http://localhost/api/conversations/${CONVERSATION_ID}/messages/stream`,
      { headers: { "last-event-id": "m50" }, signal: controller.signal },
    );

      await MESSAGES_STREAM(request, conversationParams);
      controller.abort();

      // Com cursor, a busca é pelo id exato. Sem ele, seria a mensagem mais
      // recente — o que perderia tudo o que chegou enquanto o cliente estava fora.
      expect(mockPrisma.message.findFirst.mock.calls[0][0].where).toEqual({
        id: "m50",
        conversationId: CONVERSATION_ID,
      });
  });

  it("reads the newest message when resuming from a cursor query param", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: CONVERSATION_ID,
      participant1Id: "u1",
      participant2Id: "u2",
    });
    mockPrisma.message.findFirst.mockResolvedValue({ id: "m50", createdAt: new Date() });
    const { request, abort } = makeRequest(
      `http://localhost/api/conversations/${CONVERSATION_ID}/messages/stream?cursor=m50`,
    );

    await MESSAGES_STREAM(request, conversationParams);
    abort();

    expect(mockPrisma.message.findFirst.mock.calls[0][0].where).toEqual({
      id: "m50",
      conversationId: CONVERSATION_ID,
    });
  });

  it("polls faster than the notifications stream", async () => {
    vi.useFakeTimers();
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: CONVERSATION_ID,
      participant1Id: "u1",
      participant2Id: "u2",
    });
    const { request, abort } = makeRequest(
      `http://localhost/api/conversations/${CONVERSATION_ID}/messages/stream`,
    );

    const response = await MESSAGES_STREAM(request, conversationParams);
    await readUntil(response, /retry: 5000/);
    const initial = mockPrisma.message.findMany.mock.calls.length;
    await vi.advanceTimersByTimeAsync(14_000);
    expect(mockPrisma.message.findMany.mock.calls.length).toBe(initial);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(mockPrisma.message.findMany.mock.calls.length).toBe(initial + 1);
    abort();
  });

  it("emits a heartbeat every fifth poll", async () => {
    vi.useFakeTimers();
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: CONVERSATION_ID,
      participant1Id: "u1",
      participant2Id: "u2",
    });
    const { request, abort } = makeRequest(
      `http://localhost/api/conversations/${CONVERSATION_ID}/messages/stream`,
    );

    const response = await MESSAGES_STREAM(request, conversationParams);
    await readUntil(response, /retry: 5000/);
    await vi.advanceTimersByTimeAsync(15_000 * 5);
    const buffer = await readUntil(response, /: heartbeat/);
    abort();

    expect(buffer).toContain(": heartbeat");
  });

  it("closes the stream when the session token is no longer valid", async () => {
    vi.useFakeTimers();
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: CONVERSATION_ID,
      participant1Id: "u1",
      participant2Id: "u2",
    });
    // Válida na abertura, inválida na sondagem seguinte — requireAuth consulta o
    // tokenVersion antes de o stream existir.
    let calls = 0;
    mockPrisma.user.findUnique.mockImplementation(() => {
      calls += 1;
      return Promise.resolve(
        calls <= 2 ? { tokenVersion: 3, emailVerified: true } : { tokenVersion: 99, emailVerified: true },
      );
    });
    const { request, abort } = makeRequest(
      `http://localhost/api/conversations/${CONVERSATION_ID}/messages/stream`,
    );

    const response = await MESSAGES_STREAM(request, conversationParams);
    await readUntil(response, /retry: 5000/);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(15_000);

    const reader = response.body!.getReader();
    let done = false;
    for (let i = 0; i < 5 && !done; i += 1) {
      done = (await reader.read()).done;
    }
    reader.releaseLock();
    abort();

    expect(done).toBe(true);
  });
});
