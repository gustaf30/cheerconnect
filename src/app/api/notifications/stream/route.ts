import { requireAuth, internalError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const userId = session.user.id;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let heartbeatCounter = 0;

        const poll = async () => {
          try {
            if (request.signal.aborted) {
              controller.close();
              return;
            }

            heartbeatCounter++;

            // Every 3rd tick (15s), send heartbeat
            if (heartbeatCounter % 3 === 0) {
              controller.enqueue(encoder.encode(": heartbeat\n\n"));
            }

            const [count, notifications] = await Promise.all([
              prisma.notification.count({
                where: {
                  userId,
                  isRead: false,
                  type: { not: "MESSAGE_RECEIVED" },
                },
              }),
              prisma.notification.findMany({
                where: {
                  userId,
                  type: { not: "MESSAGE_RECEIVED" },
                },
                include: {
                  actor: {
                    select: {
                      id: true,
                      name: true,
                      username: true,
                      avatar: true,
                    },
                  },
                },
                orderBy: { createdAt: "desc" },
                take: 5,
              }),
            ]);

            const data = JSON.stringify({ count, notifications });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } catch {
            // Silently handle errors
          }
        };

        // Send initial data immediately
        await poll();

        const intervalId = setInterval(poll, 5000);

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
