"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, X, UserMinus, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { staggerContainer, fadeSlideUp, noMotion, noMotionContainer, stagger } from "@/lib/animations";
import { toast } from "sonner";
import { cn, getInitials } from "@/lib/utils";
import { positionLabels } from "@/lib/constants";
import { ConnectionUser } from "@/types";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

interface Connection {
  id: string;
  status: string;
  createdAt: string;
  user: ConnectionUser;
  isSender: boolean;
}

function ConnectionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "all";

  const [pendingReceived, setPendingReceived] = useState<Connection[]>([]);
  const [pendingSent, setPendingSent] = useState<Connection[]>([]);
  const [isPendingLoading, setIsPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [removeTargetId, setRemoveTargetId] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Scroll infinito para conexões aceitas
  const fetchAccepted = useCallback(async (cursor: string | null) => {
    const url = cursor
      ? `/api/connections?status=ACCEPTED&cursor=${cursor}`
      : "/api/connections?status=ACCEPTED";
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return { items: data.connections as Connection[], nextCursor: data.nextCursor as string | null };
  }, []);

  const {
    items: connections,
    setItems: setConnections,
    isLoading: isAcceptedLoading,
    isLoadingMore,
    error: acceptedError,
    sentinelRef,
    reset: resetConnections,
  } = useInfiniteScroll({ fetchFn: fetchAccepted });

  // Busca única para conexões pendentes (conjunto tipicamente pequeno)
  const fetchPending = useCallback(async () => {
    setPendingError(null);
    try {
      const res = await fetch("/api/connections?status=PENDING");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPendingReceived(data.connections.filter((c: Connection) => !c.isSender));
      setPendingSent(data.connections.filter((c: Connection) => c.isSender));
    } catch {
      setPendingError("Erro ao carregar solicitações");
    } finally {
      setIsPendingLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleAccept = async (userId: string) => {
    try {
      const response = await fetch(`/api/connections/${userId}/accept`, {
        method: "POST",
      });

      if (!response.ok) throw new Error();

      const accepted = pendingReceived.find((c) => c.user.id === userId);
      if (accepted) {
        setPendingReceived((prev) =>
          prev.filter((c) => c.user.id !== userId)
        );
        setConnections((prev) => [
          { ...accepted, status: "ACCEPTED" },
          ...prev,
        ]);
      }

      toast.success("Conexão aceita!");
    } catch {
      toast.error("Erro ao aceitar conexão");
    }
  };

  const handleReject = async (userId: string) => {
    try {
      const response = await fetch(`/api/connections/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error();

      setPendingReceived((prev) =>
        prev.filter((c) => c.user.id !== userId)
      );
      toast.success("Solicitação rejeitada");
    } catch {
      toast.error("Erro ao rejeitar solicitação");
    }
  };

  const handleCancel = async (userId: string) => {
    try {
      const response = await fetch(`/api/connections/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error();

      setPendingSent((prev) => prev.filter((c) => c.user.id !== userId));
      toast.success("Solicitação cancelada");
    } catch {
      toast.error("Erro ao cancelar solicitação");
    }
  };

  const handleRemove = async () => {
    if (!removeTargetId) return;
    setIsRemoving(true);
    try {
      const response = await fetch(`/api/connections/${removeTargetId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error();

      setConnections((prev) => prev.filter((c) => c.user.id !== removeTargetId));
      setRemoveTargetId(null);
      toast.success("Conexão removida");
    } catch {
      toast.error("Erro ao remover conexão");
    } finally {
      setIsRemoving(false);
    }
  };

  const ConnectionCard = ({
    connection,
    type,
  }: {
    connection: Connection;
    type: "connected" | "received" | "sent";
  }) => (
    <div className="flex items-center justify-between p-4 bento-card-static">
      <Link
        href={`/profile/${connection.user.username}`}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <Avatar className="h-12 w-12 shrink-0 avatar-glow">
          <AvatarImage
            src={connection.user.avatar || undefined}
            alt={connection.user.name}
          />
          <AvatarFallback className="bg-primary text-primary-foreground font-display font-semibold">
            {getInitials(connection.user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="font-display font-semibold truncate">{connection.user.name}</div>
          <div className="text-sm text-muted-foreground truncate font-mono">
            @{connection.user.username}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {connection.user.positions.slice(0, 2).map((pos) => (
              <Badge key={pos} variant="gradient" className="text-xs">
                {positionLabels[pos] || pos}
              </Badge>
            ))}
          </div>
        </div>
      </Link>

      <div className="flex gap-2 ml-4">
        {type === "received" && (
          <>
            <Button
              size="sm"
              onClick={() => handleAccept(connection.user.id)}
              aria-label="Aceitar conexão"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReject(connection.user.id)}
              aria-label="Rejeitar conexão"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
        {type === "sent" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCancel(connection.user.id)}
          >
            Cancelar
          </Button>
        )}
        {type === "connected" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRemoveTargetId(connection.user.id)}
            aria-label="Remover conexão"
          >
            <UserMinus className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  const shouldReduceMotion = useReducedMotion();
  const containerVariants = shouldReduceMotion
    ? noMotionContainer
    : staggerContainer(stagger.default);
  const itemVariants = shouldReduceMotion ? noMotion : fadeSlideUp;
  const exitVariants = shouldReduceMotion
    ? { opacity: 0, transition: { duration: 0.1 } }
    : { opacity: 0, x: -20, transition: { duration: 0.2 } };

  const isLoading = isAcceptedLoading || isPendingLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="heading-section font-display">Conexões</h2>
        <div className="bento-card-static p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (acceptedError && pendingError) {
    return (
      <div className="space-y-6">
        <h2 className="heading-section font-display">Conexões</h2>
        <ErrorState message="Erro ao carregar conexões" onRetry={() => { resetConnections(); fetchPending(); }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho com estatísticas — clicáveis como navegação de tabs */}
      <div className="bento-card-static">
        <div className="accent-bar" />
        <div className="p-5">
          <h1 className="heading-section font-display mb-4">Conexões</h1>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => router.replace("/connections?tab=all", { scroll: false })}
              className={cn(
                "text-center rounded-lg py-2 transition-base cursor-pointer",
                tab === "all" ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/50"
              )}
            >
              <span className={cn("font-mono text-2xl font-bold", tab === "all" ? "text-primary" : "text-muted-foreground")}>{connections.length}</span>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Conexões</p>
            </button>
            <button
              onClick={() => router.replace("/connections?tab=received", { scroll: false })}
              className={cn(
                "text-center rounded-lg py-2 transition-base cursor-pointer border-x border-border/50",
                tab === "received" ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/50"
              )}
            >
              <span className={cn("font-mono text-2xl font-bold", tab === "received" ? "text-primary" : "text-muted-foreground")}>{pendingReceived.length}</span>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Recebidas</p>
            </button>
            <button
              onClick={() => router.replace("/connections?tab=sent", { scroll: false })}
              className={cn(
                "text-center rounded-lg py-2 transition-base cursor-pointer",
                tab === "sent" ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/50"
              )}
            >
              <span className={cn("font-mono text-2xl font-bold", tab === "sent" ? "text-primary" : "text-muted-foreground")}>{pendingSent.length}</span>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Enviadas</p>
            </button>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => router.replace(`/connections?tab=${v}`, { scroll: false })}>
        <TabsList className="sr-only">
          <TabsTrigger value="all">
            Todas
          </TabsTrigger>
          <TabsTrigger value="received">
            Recebidas
          </TabsTrigger>
          <TabsTrigger value="sent">
            Enviadas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="space-y-3">
              {connections.length === 0 ? (
                <div className="bento-card-static p-8 text-center text-muted-foreground">
                  Você ainda não tem conexões. Comece a conectar-se com outros
                  atletas!
                </div>
              ) : (
                <motion.div
                  className="space-y-3"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <AnimatePresence mode="popLayout">
                    {connections.map((connection) => (
                      <motion.div
                        key={connection.id}
                        variants={itemVariants}
                        exit={exitVariants}
                        layout
                      >
                        <ConnectionCard
                          connection={connection}
                          type="connected"
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
              <div ref={sentinelRef} />
              {isLoadingMore && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
          </div>
        </TabsContent>

        <TabsContent value="received" className="mt-4">
          <div className="space-y-3">
              {pendingReceived.length === 0 ? (
                <div className="bento-card-static p-8 text-center text-muted-foreground">
                  Nenhuma solicitação pendente.
                </div>
              ) : (
                <motion.div
                  className="space-y-3"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <AnimatePresence mode="popLayout">
                    {pendingReceived.map((connection) => (
                      <motion.div
                        key={connection.id}
                        variants={itemVariants}
                        exit={exitVariants}
                        layout
                      >
                        <ConnectionCard
                          connection={connection}
                          type="received"
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
          </div>
        </TabsContent>

        <TabsContent value="sent" className="mt-4">
          <div className="space-y-3">
              {pendingSent.length === 0 ? (
                <div className="bento-card-static p-8 text-center text-muted-foreground">
                  Você não tem solicitações pendentes.
                </div>
              ) : (
                <motion.div
                  className="space-y-3"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <AnimatePresence mode="popLayout">
                    {pendingSent.map((connection) => (
                      <motion.div
                        key={connection.id}
                        variants={itemVariants}
                        exit={exitVariants}
                        layout
                      >
                        <ConnectionCard
                          connection={connection}
                          type="sent"
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!removeTargetId}
        onOpenChange={(open) => !open && setRemoveTargetId(null)}
        title="Remover esta conexão?"
        confirmLabel="Remover"
        isLoading={isRemoving}
        onConfirm={handleRemove}
      />
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<ConnectionsSkeleton />}>
      <ConnectionsContent />
    </Suspense>
  );
}

function ConnectionsSkeleton() {
  return (
    <div className="space-y-6">
      <h2 className="heading-section font-display">Conexões</h2>
      <div className="bento-card-static p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
