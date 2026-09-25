import { requireAuth, internalError, isSessionTokenValid, getBlockedUserIds } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { subscribeRealtimeEvents } from "@/lib/realtime-bus";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const userId = session.user.id;

    // Modo idle (aba invisível) usa intervalo maior para economizar bateria
    const url = new URL(request.url);
    const isIdle = url.searchParams.get("idle") === "true";
    const pollInterval = isIdle ? 60000 : 30000;

    const stream = new ReadableStream({
      async start(controller) {
         const encoder = new TextEncoder();
         controller.enqueue(encoder.encode("retry: 5000\n\n"));
         let prevNotificationCount = -1;
        let prevMessageCount = -1;
        let prevLastMessageAt = "";
         let stopped = false;
         let polling = false;
         const intervalRef: { current?: ReturnType<typeof setInterval> } = {};
        let unsubscribe: () => void = () => {};
         let blockedUserIds = await getBlockedUserIds(userId);

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
           if (stopped || polling) return;
           polling = true;
           try {
             blockedUserIds = await getBlockedUserIds(userId);
            if (request.signal.aborted) {
              close();
              return;
            }

            if (!(await isSessionTokenValid(userId, session.user.tokenVersion))) {
              close();
              return;
            }

            const [notificationCount, messageCount, lastConversation] =
              await Promise.all([
                prisma.notification.count({
                  where: {
                    userId,
                    actorId: { notIn: blockedUserIds },
                    isRead: false,
                    type: { not: "MESSAGE_RECEIVED" },
                  },
                }),
                prisma.message.count({
                  where: {
                    isRead: false,
                    senderId: { notIn: [userId, ...blockedUserIds] },


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
             return;
           } finally {
             polling = false;
           }
         };

         unsubscribe = subscribeRealtimeEvents((event) => {
           if (event.userId === userId) void poll();
         });
         await poll();
         if (stopped) return;

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
    return internalError("Erro ao iniciar stream de notificações", error);
  }
}
