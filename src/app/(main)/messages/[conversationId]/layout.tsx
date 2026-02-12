import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}): Promise<Metadata> {
  try {
    const { conversationId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { title: "Mensagens | CheerConnect" };

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        participant1: { select: { name: true } },
        participant2: { select: { name: true } },
        participant1Id: true,
      },
    });

    if (!conversation) return { title: "Mensagens | CheerConnect" };

    const otherName =
      conversation.participant1Id === session.user.id
        ? conversation.participant2.name
        : conversation.participant1.name;

    return { title: `Conversa com ${otherName} | CheerConnect` };
  } catch {
    return { title: "Mensagens | CheerConnect" };
  }
}

export default function ConversationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
