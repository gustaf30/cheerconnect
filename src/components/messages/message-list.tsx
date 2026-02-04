"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { MessageBubble, Message } from "./message-bubble";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface MessageListProps {
  conversationId: string;
  currentUserId: string;
  onNewMessage?: () => void;
}

export function MessageList({ conversationId, currentUserId, onNewMessage }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const fetchMessages = useCallback(async (cursor?: string) => {
    try {
      if (cursor) {
        setIsLoadingMore(true);
      }

      const url = cursor
        ? `/api/conversations/${conversationId}/messages?cursor=${cursor}`
        : `/api/conversations/${conversationId}/messages`;

      const response = await fetch(url);
      if (!response.ok) throw new Error();

      const data = await response.json();

      if (cursor) {
        // Prepend older messages
        setMessages((prev) => [...data.messages, ...prev]);
      } else {
        setMessages(data.messages);
        lastMessageCountRef.current = data.messages.length;
      }

      setNextCursor(data.nextCursor);
    } catch {
      toast.error("Erro ao carregar mensagens");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [conversationId]);

  // Mark messages as read
  const markAsRead = useCallback(async () => {
    try {
      await fetch(`/api/conversations/${conversationId}/messages/read`, {
        method: "POST",
      });
    } catch {
      // Silently fail
    }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
    markAsRead();
  }, [fetchMessages, markAsRead]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      scrollToBottom();
      lastMessageCountRef.current = messages.length;
    }
  }, [messages.length]);

  // Initial scroll to bottom
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      scrollToBottom("instant");
    }
  }, [isLoading]);

  // Poll for new messages
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/conversations/${conversationId}/messages`);
        if (!response.ok) return;

        const data = await response.json();
        if (data.messages.length > messages.length) {
          setMessages(data.messages);
          markAsRead();
          onNewMessage?.();
        }
      } catch {
        // Silently fail
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [conversationId, messages.length, markAsRead, onNewMessage]);

  // Load more on scroll to top
  const handleScroll = useCallback(() => {
    if (!containerRef.current || isLoadingMore || !nextCursor) return;

    if (containerRef.current.scrollTop === 0) {
      fetchMessages(nextCursor);
    }
  }, [fetchMessages, isLoadingMore, nextCursor]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`flex items-end gap-2 max-w-[80%] ${i % 2 === 0 ? "ml-auto" : ""}`}
          >
            {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full shrink-0" />}
            <Skeleton
              className={`h-16 rounded-2xl ${i % 2 === 0 ? "w-48" : "w-64"}`}
            />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-lg mb-1">Nenhuma mensagem</h3>
        <p className="text-sm text-muted-foreground">
          Envie uma mensagem para iniciar a conversa
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 flex flex-col gap-2 p-4 overflow-y-auto"
    >
      {isLoadingMore && (
        <div className="flex justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {messages.map((message, index) => {
        const isOwn = message.senderId === currentUserId;
        const prevMessage = messages[index - 1];
        const showAvatar = !prevMessage || prevMessage.senderId !== message.senderId;

        return (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={isOwn}
            showAvatar={showAvatar}
          />
        );
      })}

      <div ref={messagesEndRef} />
    </div>
  );
}
