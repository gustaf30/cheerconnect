"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { MessageBubble, Message } from "./message-bubble";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  staggerContainer,
  slideFromLeft,
  slideFromRight,
  noMotion,
  noMotionContainer,
} from "@/lib/animations";

interface MessageListProps {
  conversationId: string;
  currentUserId: string;
}

export function MessageList({ conversationId, currentUserId }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);
  const isInitialLoadRef = useRef(true);
  const lastStreamCursorRef = useRef<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

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
        // Adicionar mensagens antigas no início
        setMessages((prev) => [...data.messages, ...prev].sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
          a.id.localeCompare(b.id)
        ));
       } else {
         setMessages([...data.messages].reverse());
         lastStreamCursorRef.current = data.messages[0]?.id ?? null;
         lastMessageCountRef.current = data.messages.length;
        // Mark initial load complete after first successful fetch
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 0);
      }

      setNextCursor(data.nextCursor);
    } catch {
      toast.error("Erro ao carregar mensagens");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [conversationId]);

  // Marcar mensagens como lidas
  const markAsRead = useCallback(async () => {
    try {
      await fetch(`/api/conversations/${conversationId}/messages/read`, {
        method: "POST",
      });
    } catch {
      // Falhar silenciosamente
    }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
    markAsRead();
  }, [fetchMessages, markAsRead]);

  // Auto-scroll quando novas mensagens chegam
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      scrollToBottom();
      lastMessageCountRef.current = messages.length;
    }
  }, [messages.length]);

  // Scroll inicial para o final
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      scrollToBottom("instant");
    }
  }, [isLoading, messages.length]);

  useEffect(() => {
    const handleMessageSent = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId: string; message: Message }>).detail;
      if (!detail || detail.conversationId !== conversationId) return;
      setMessages((prev) => {
        if (prev.some((message) => message.id === detail.message.id)) return prev;
        return [...prev, detail.message].sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
          a.id.localeCompare(b.id)
        );
      });
    };
    window.addEventListener("cheerconnect:message-sent", handleMessageSent);
    return () => window.removeEventListener("cheerconnect:message-sent", handleMessageSent);
  }, [conversationId]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let retryDelay = 1000;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let pageVisible = !document.hidden;

    const connect = () => {
      if (stopped) return;
      const params = new URLSearchParams();
      if (!pageVisible) params.set("idle", "true");
      if (lastStreamCursorRef.current) params.set("cursor", lastStreamCursorRef.current);
      const query = params.toString();
      eventSource = new EventSource(
        `/api/conversations/${conversationId}/messages/stream${query ? `?${query}` : ""}`
      );

      eventSource.onopen = () => {
        retryDelay = 1000;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_messages" && data.messages?.length > 0) {
            if (event.lastEventId) lastStreamCursorRef.current = event.lastEventId;
            else lastStreamCursorRef.current = data.messages[data.messages.length - 1]?.id ?? lastStreamCursorRef.current;
            setMessages((prev) => {
              const existingIds = new Set(prev.map((message) => message.id));
              const newMessages = data.messages.filter((message: Message) => !existingIds.has(message.id));
              return newMessages.length > 0
                ? [...prev, ...newMessages].sort((a, b) =>
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id)
                  )
                : prev;
            });
            void markAsRead();
          }
        } catch {
          return;
        }
      };

      eventSource.onerror = () => {
        if (stopped) return;
        eventSource?.close();
        eventSource = null;
        retryTimeout = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30000);
          connect();
        }, retryDelay);
      };
    };

    const handleOnline = () => {
      clearTimeout(retryTimeout);
      eventSource?.close();
      connect();
    };
    const handleVisibilityChange = () => {
      const nextVisible = !document.hidden;
      if (nextVisible === pageVisible) return;
      pageVisible = nextVisible;
      clearTimeout(retryTimeout);
      eventSource?.close();
      eventSource = null;
      connect();
    };

    connect();
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopped = true;
      eventSource?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [conversationId, markAsRead]);

  // Carregar mais ao rolar para o topo
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
        <h3 className="heading-card mb-1">Nenhuma mensagem</h3>
        <p className="text-sm text-muted-foreground">
          Envie uma mensagem para iniciar a conversa
        </p>
      </div>
    );
  }

  const containerVariants = shouldReduceMotion
    ? noMotionContainer
    : staggerContainer(0.04);

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

      <motion.div
        className="flex flex-col gap-2"
        variants={containerVariants}
        initial={isInitialLoadRef.current ? "hidden" : false}
        animate="visible"
      >
        {messages.map((message, index) => {
          const isOwn = message.senderId === currentUserId;
          const prevMessage = messages[index - 1];
          const showAvatar = !prevMessage || prevMessage.senderId !== message.senderId;

          const itemVariants = shouldReduceMotion
            ? noMotion
            : isOwn
              ? slideFromRight
              : slideFromLeft;

          return (
            <motion.div key={message.id} variants={itemVariants}>
              <MessageBubble
                message={message}
                isOwn={isOwn}
                showAvatar={showAvatar}
              />
            </motion.div>
          );
        })}
      </motion.div>

      <div ref={messagesEndRef} />
    </div>
  );
}
