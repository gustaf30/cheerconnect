"use client";

import { useEffect, useCallback } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { ConversationItem, Conversation } from "./conversation-item";
import { Skeleton } from "@/components/ui/skeleton";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

interface ConversationListProps {
  activeConversationId?: string;
}

export function ConversationList({ activeConversationId }: ConversationListProps) {
  const fetchConversations = useCallback(async (cursor: string | null) => {
    const url = cursor
      ? `/api/conversations?cursor=${cursor}`
      : "/api/conversations";
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return { items: data.conversations as Conversation[], nextCursor: data.nextCursor as string | null };
  }, []);

  const {
    items: conversations,
    isLoading,
    isLoadingMore,
    sentinelRef,
    reset,
  } = useInfiniteScroll({ fetchFn: fetchConversations });

  // Refresh conversations periodically (re-fetches first page)
  useEffect(() => {
    const interval = setInterval(() => {
      reset();
    }, 30000);
    return () => clearInterval(interval);
  }, [reset]);

  if (isLoading) {
    return (
      <div className="flex flex-col">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 border-b">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-lg mb-1">Nenhuma conversa</h3>
        <p className="text-sm text-muted-foreground">
          Conecte-se com outros usuários para começar uma conversa
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          isActive={conversation.id === activeConversationId}
        />
      ))}
      <div ref={sentinelRef} />
      {isLoadingMore && (
        <div className="flex justify-center py-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
