"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, MessageSquare, Loader2, Users } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import {
  staggerContainer,
  fadeSlideUp,
  noMotion,
  noMotionContainer,
} from "@/lib/animations";

interface Connection {
  id: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    positions: string[];
    location: string | null;
  };
}

interface ExistingConversation {
  id: string;
  otherParticipant: {
    id: string;
  };
}

export function ConnectionSearch() {
  const shouldReduceMotion = useReducedMotion();
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [conversations, setConversations] = useState<ExistingConversation[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [startingConversation, setStartingConversation] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(false);
    setIsLoading(true);
    try {
      const [connectionsRes, conversationsRes] = await Promise.all([
        fetch("/api/connections?status=ACCEPTED"),
        fetch("/api/conversations"),
      ]);

      if (!connectionsRes.ok || !conversationsRes.ok) throw new Error();

      const [connectionsData, conversationsData] = await Promise.all([
        connectionsRes.json(),
        conversationsRes.json(),
      ]);

      setConnections(connectionsData.connections);
      setConversations(conversationsData.conversations);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Map user IDs to conversation IDs for quick lookup
  const userConversationMap = useMemo(() => {
    const map = new Map<string, string>();
    conversations.forEach((conv) => {
      map.set(conv.otherParticipant.id, conv.id);
    });
    return map;
  }, [conversations]);

  // Filtrar conexões pelo termo de busca
  const filteredConnections = useMemo(() => {
    if (!search.trim()) return connections;

    const searchLower = search.toLowerCase();
    return connections.filter(
      (conn) =>
        conn.user.name.toLowerCase().includes(searchLower) ||
        conn.user.username.toLowerCase().includes(searchLower)
    );
  }, [connections, search]);

  const handleSelectConnection = async (userId: string) => {
    const existingConversationId = userConversationMap.get(userId);

    if (existingConversationId) {
      router.push(`/messages/${existingConversationId}`);
      return;
    }

    // Criar nova conversa
    setStartingConversation(userId);
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: userId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao iniciar conversa");
      }

      const data = await response.json();
      router.push(`/messages/${data.conversation.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao iniciar conversa");
    } finally {
      setStartingConversation(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-3">
        <Skeleton className="h-9 w-full" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 px-4 text-sm text-muted-foreground">
        <p>Erro ao carregar conexões.</p>
        <Button variant="outline" size="sm" onClick={fetchData}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="rounded-full bg-muted p-3 mb-3">
          <Users className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-medium mb-1">Nenhuma conexão</h3>
        <p className="text-sm text-muted-foreground">
          Conecte-se com outros usuários para enviar mensagens
        </p>
      </div>
    );
  }

  const containerVariants = shouldReduceMotion
    ? noMotionContainer
    : staggerContainer(0.06);
  const itemVariants = shouldReduceMotion ? noMotion : fadeSlideUp;

  return (
    <div className="space-y-3 p-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar conexões..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
        Conexões ({filteredConnections.length})
      </div>

      <motion.div
        className="space-y-1 max-h-48 overflow-y-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        key={search}
      >
        {filteredConnections.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma conexão encontrada
          </p>
        ) : (
          filteredConnections.map((conn) => {
            const hasConversation = userConversationMap.has(conn.user.id);
            const isStarting = startingConversation === conn.user.id;

            return (
              <motion.div key={conn.id} variants={itemVariants}>
                <button
                  onClick={() => handleSelectConnection(conn.user.id)}
                  disabled={isStarting}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left",
                    isStarting && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={conn.user.avatar || undefined}
                      alt={conn.user.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {getInitials(conn.user.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{conn.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{conn.user.username}
                    </p>
                  </div>

                  {isStarting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : hasConversation ? (
                    <MessageSquare className="h-4 w-4 text-primary" />
                  ) : null}
                </button>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </div>
  );
}
