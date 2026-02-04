"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConversationList } from "@/components/messages/conversation-list";
import { ConnectionSearch } from "@/components/messages/connection-search";
import { MessageList } from "@/components/messages/message-list";
import { MessageInput } from "@/components/messages/message-input";
import { toast } from "sonner";

interface OtherParticipant {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
}

interface Conversation {
  id: string;
  otherParticipant: OtherParticipant;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
}

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchConversation = useCallback(async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`);
      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          router.push("/messages");
          return;
        }
        throw new Error();
      }

      const data = await response.json();
      setConversation(data.conversation);
    } catch {
      toast.error("Erro ao carregar conversa");
      router.push("/messages");
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, router]);

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  const handleMessageSent = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="hidden lg:block lg:col-span-1 h-[calc(100vh-8rem)]">
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Mensagens
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Connection Search Section */}
            <div className="border-b">
              <ConnectionSearch />
            </div>
            {/* Conversations List Section */}
            <div className="overflow-y-auto max-h-[calc(100vh-24rem)]">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2">
                Conversas Recentes
              </div>
              <ConversationList activeConversationId={conversationId} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 h-[calc(100vh-8rem)] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </Card>
      </div>
    );
  }

  if (!conversation || !session?.user?.id) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Conversations List - Desktop */}
      <Card className="hidden lg:block lg:col-span-1 h-[calc(100vh-8rem)]">
        <CardHeader className="border-b pb-3">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Mensagens
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Connection Search Section */}
          <div className="border-b">
            <ConnectionSearch />
          </div>
          {/* Conversations List Section */}
          <div className="overflow-y-auto max-h-[calc(100vh-24rem)]">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2">
              Conversas Recentes
            </div>
            <ConversationList activeConversationId={conversationId} />
          </div>
        </CardContent>
      </Card>

      {/* Conversation View */}
      <Card className="lg:col-span-2 h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <CardHeader className="border-b shrink-0 py-3">
          <div className="flex items-center gap-3">
            <Link href="/messages" className="lg:hidden">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>

            <Link
              href={`/profile/${conversation.otherParticipant.username}`}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={conversation.otherParticipant.avatar || undefined}
                  alt={conversation.otherParticipant.name}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials(conversation.otherParticipant.name)}
                </AvatarFallback>
              </Avatar>

              <div>
                <h2 className="font-semibold">{conversation.otherParticipant.name}</h2>
                <p className="text-sm text-muted-foreground">
                  @{conversation.otherParticipant.username}
                </p>
              </div>
            </Link>
          </div>
        </CardHeader>

        {/* Messages */}
        <MessageList
          key={refreshKey}
          conversationId={conversationId}
          currentUserId={session.user.id}
          onNewMessage={handleMessageSent}
        />

        {/* Input */}
        <MessageInput
          conversationId={conversationId}
          onMessageSent={handleMessageSent}
        />
      </Card>
    </div>
  );
}
