import { requireAuth, internalError, getConversationWithAccessCheck } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

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
    const pollInterval = isIdle ? 10000 : 3000;

    let lastTimestamp = new Date();

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

            // Every 5th tick (15s), send heartbeat
            if (heartbeatCounter % 5 === 0) {
              controller.enqueue(encoder.encode(": heartbeat\n\n"));
            }

            const newMessages = await prisma.message.findMany({
              where: {
                conversationId,
                createdAt: { gt: lastTimestamp },
              },
              orderBy: { createdAt: "asc" },
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
              lastTimestamp = newMessages[newMessages.length - 1].createdAt;

              // Marcar mensagens do outro participante como lidas (conversa aberta)
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
                  data: { isRead: true },
                });
              }

              const data = JSON.stringify({
                type: "new_messages",
                messages: newMessages,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          } catch {
            // Silently handle errors during polling
          }
        };

        const intervalId = setInterval(poll, pollInterval);

        // Cleanup on abort
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
    return internalError("Erro ao iniciar stream de mensagens", error);
  }
}
