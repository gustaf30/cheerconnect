"use client";

import { useEffect, useCallback, useRef } from "react";
import { MessageSquare, Loader2, RefreshCw } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { ConversationItem, Conversation } from "./conversation-item";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import {
  staggerContainer,
  fadeSlideUp,
  noMotion,
  noMotionContainer,
} from "@/lib/animations";
import { useRealtime } from "@/hooks/use-realtime";

interface ConversationListProps {
  activeConversationId?: string;
}

export function ConversationList({ activeConversationId }: ConversationListProps) {
  const shouldReduceMotion = useReducedMotion();

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
    error,
    sentinelRef,
    reset,
  } = useInfiniteScroll({ fetchFn: fetchConversations });

  // Refresh conversation list when a new message arrives (SSE-driven)
  const { lastMessageAt } = useRealtime();
  const prevLastMessageAtRef = useRef(lastMessageAt);

  useEffect(() => {
    // Skip initial mount
    if (prevLastMessageAtRef.current === null && lastMessageAt === null) return;
    if (lastMessageAt !== prevLastMessageAtRef.current) {
      prevLastMessageAtRef.current = lastMessageAt;
      reset();
    }
  }, [lastMessageAt, reset]);

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

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
        <p>Erro ao carregar conversas.</p>
        <Button variant="outline" size="sm" onClick={reset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
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

  const containerVariants = shouldReduceMotion
    ? noMotionContainer
    : staggerContainer(0.06);
  const itemVariants = shouldReduceMotion ? noMotion : fadeSlideUp;

  return (
    <motion.div
      className="flex flex-col"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {conversations.map((conversation) => (
        <motion.div key={conversation.id} variants={itemVariants}>
          <ConversationItem
            conversation={conversation}
            isActive={conversation.id === activeConversationId}
          />
        </motion.div>
      ))}
      <div ref={sentinelRef} />
      {isLoadingMore && (
        <div className="flex justify-center py-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </motion.div>
  );
}
