import { requireAuth, internalError, getConversationWithAccessCheck, isSessionTokenValid } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { subscribeRealtimeEvents } from "@/lib/realtime-bus";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id: conversationId } = await params;
    const userId = session.user.id;

    // Verify user is a participant
    const conversation = await getConversationWithAccessCheck(conversationId, userId);

    if (!conversation) {
      return new Response("Conversation not found", { status: 404 });
    }

    // Modo idle (aba invisível) usa intervalo maior para economizar bateria
    const url = new URL(request.url);
    const isIdle = url.searchParams.get("idle") === "true";
    const pollInterval = isIdle ? 30000 : 15000;

    const now = Date.now();
     const lastEventId = request.headers.get("last-event-id") || url.searchParams.get("cursor");
    const latestMessage = lastEventId
      ? await prisma.message.findFirst({
          where: { id: lastEventId, conversationId },
          select: { id: true, createdAt: true },
        })
      : await prisma.message.findFirst({
          where: { conversationId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, createdAt: true },
        });
    let lastMessageId: string | null = latestMessage?.id ?? null;
    let lastTimestamp = new Date(
      Math.min(latestMessage?.createdAt.getTime() ?? now, now - 30_000)
    );

    const stream = new ReadableStream({
      async start(controller) {
         const encoder = new TextEncoder();
         controller.enqueue(encoder.encode("retry: 5000\n\n"));
         let heartbeatCounter = 0;
        let polling = false;
        let stopped = false;
        const intervalRef: { current?: ReturnType<typeof setInterval> } = {};
        let unsubscribe: () => void = () => {};

        const close = () => {
          if (stopped) return;
          stopped = true;
          if (intervalRef.current) clearInterval(intervalRef.current);
          unsubscribe();
          try {
            controller.close();
          } catch {
            return;
          }
        };

        const poll = async () => {
          if (polling || stopped) return;
          polling = true;
          try {
            if (request.signal.aborted) {
              close();
              return;
            }

            if (!(await isSessionTokenValid(userId, session.user.tokenVersion))) {
              close();
              return;
            }

            heartbeatCounter++;

            if (heartbeatCounter % 5 === 0) {
              controller.enqueue(encoder.encode(": heartbeat\n\n"));
            }

            const newMessages = await prisma.message.findMany({
              where: {
                conversationId,
                OR: [
                  { createdAt: { gt: lastTimestamp } },
                  ...(lastMessageId
                    ? [{ createdAt: lastTimestamp, id: { gt: lastMessageId } }]
                    : []),
                ],
              },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              include: {
                sender: {
                  select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true,
                  },
                },
              },
            });

            if (newMessages.length > 0) {
              const lastMessage = newMessages[newMessages.length - 1];
              lastTimestamp = lastMessage.createdAt;
              lastMessageId = lastMessage.id;

              const hasUnreadFromOther = newMessages.some(
                (m) => m.senderId !== userId && !m.isRead
              );
              if (hasUnreadFromOther) {
                await prisma.message.updateMany({
                  where: {
                    conversationId,
                    senderId: { not: userId },
                    isRead: false,
                  },
                  data: { isRead: true, readAt: new Date() },
                });
              }

              const data = JSON.stringify({
                type: "new_messages",
                messages: newMessages,
              });
              controller.enqueue(
                encoder.encode(`id: ${lastMessage.id}\ndata: ${data}\n\n`)
              );
            }
          } catch {
            return;
          } finally {
            polling = false;
          }
        };

        unsubscribe = subscribeRealtimeEvents((event) => {
          if (event.type === "message" && event.conversationId === conversationId) {
            void poll();
          }
         });
         void poll();
         intervalRef.current = setInterval(poll, pollInterval);

        request.signal.addEventListener("abort", close);
      },
    });


    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
         "Cache-Control": "private, no-cache, no-transform",
         "X-Accel-Buffering": "no",
         Connection: "keep-alive",
      },
    });
  } catch (error) {
    return internalError("Erro ao iniciar stream de mensagens", error);
  }
}
