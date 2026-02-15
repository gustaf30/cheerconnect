import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const userId = session.user.id;

    // Modo idle (aba invisível) usa intervalo maior para economizar bateria
    const url = new URL(request.url);
    const isIdle = url.searchParams.get("idle") === "true";
    const pollInterval = isIdle ? 15000 : 5000;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let prevNotificationCount = -1;
        let prevMessageCount = -1;
        let prevLastMessageAt = "";

        const poll = async () => {
          try {
            if (request.signal.aborted) {
              controller.close();
              return;
            }

            const [notificationCount, messageCount, lastConversation] =
              await Promise.all([
                prisma.notification.count({
                  where: {
                    userId,
                    isRead: false,
                    type: { not: "MESSAGE_RECEIVED" },
                  },
                }),
                prisma.message.count({
                  where: {
                    isRead: false,
                    senderId: { not: userId },
                    conversation: {
                      OR: [
                        { participant1Id: userId },
                        { participant2Id: userId },
                      ],
                    },
                  },
                }),
                prisma.conversation.findFirst({
                  where: {
                    OR: [
                      { participant1Id: userId },
                      { participant2Id: userId },
                    ],
                  },
                  orderBy: { lastMessageAt: "desc" },
                  select: { lastMessageAt: true },
                }),
              ]);

            const lastMessageAt =
              lastConversation?.lastMessageAt?.toISOString() ?? null;
            const lastMessageAtStr = lastMessageAt ?? "";

            // Only emit data when values change
            if (
              notificationCount !== prevNotificationCount ||
              messageCount !== prevMessageCount ||
              lastMessageAtStr !== prevLastMessageAt
            ) {
              prevNotificationCount = notificationCount;
              prevMessageCount = messageCount;
              prevLastMessageAt = lastMessageAtStr;

              const data = JSON.stringify({
                notificationCount,
                messageCount,
                lastMessageAt,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            } else {
              controller.enqueue(encoder.encode(`: heartbeat\n\n`));
            }
          } catch {
            // Silently handle errors
          }
        };

        // Send initial data immediately
        await poll();

        const intervalId = setInterval(poll, pollInterval);

        request.signal.addEventListener("abort", () => {
          clearInterval(intervalId);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return internalError("Erro ao iniciar stream de notificações", error);
  }
}
