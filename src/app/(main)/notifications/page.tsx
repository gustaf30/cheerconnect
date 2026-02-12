"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, useReducedMotion } from "framer-motion";
import {
  staggerContainer,
  fadeSlideUp,
  noMotion,
  noMotionContainer,
  stagger,
} from "@/lib/animations";
import { NotificationItem, type Notification } from "@/components/shared/notification-item";
import { ErrorState } from "@/components/shared/error-state";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useRealtime } from "@/hooks/use-realtime";

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = shouldReduceMotion
    ? noMotionContainer
    : staggerContainer(stagger.default);
  const itemVariants = shouldReduceMotion ? noMotion : fadeSlideUp;

  const fetchNotifications = useCallback(
    async (cursor: string | null) => {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (filter === "unread") params.set("unreadOnly", "true");
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      return {
        items: data.notifications as Notification[],
        nextCursor: (data.meta?.nextCursor as string | null) ?? null,
      };
    },
    [filter]
  );

  const {
    items: notifications,
    setItems,
    isLoading,
    isLoadingMore,
    error,
    sentinelRef,
    reset,
  } = useInfiniteScroll({ fetchFn: fetchNotifications });

  // Auto-refresh when new notifications arrive via SSE
  const { notificationCount } = useRealtime();
  const prevCountRef = useRef(notificationCount);

  useEffect(() => {
    if (notificationCount > prevCountRef.current) {
      reset();
    }
    prevCountRef.current = notificationCount;
  }, [notificationCount, reset]);

  const handleMarkAsRead = async (id: string) => {
    const previous = notifications.map((n) => ({ ...n }));
    setItems((prev) => prev.filter((n) => n.id !== id));
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems(previous);
      toast.error("Erro ao marcar notificação como lida");
    }
  };

  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const handleMarkAllAsRead = async () => {
    if (isMarkingAll) return;
    setIsMarkingAll(true);
    const previous = notifications.map((n) => ({ ...n }));
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error();
      toast.success("Notificações marcadas como lidas");
      if (filter === "unread") {
        setFilter("all");
      }
    } catch {
      setItems(previous);
      toast.error("Erro ao marcar notificações como lidas");
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleFilterChange = (newFilter: "all" | "unread") => {
    setFilter(newFilter);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="heading-section font-display">Notificações</h1>
        <Button
          variant="outline"
          size="sm"
          className="hover:bg-primary/10 hover:text-primary transition-fast"
          onClick={handleMarkAllAsRead}
          disabled={isMarkingAll || notifications.length === 0}
        >
          {isMarkingAll ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Marcar todas como lidas
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => handleFilterChange("all")}
        >
          Todas
        </Button>
        <Button
          variant={filter === "unread" ? "default" : "outline"}
          size="sm"
          onClick={() => handleFilterChange("unread")}
        >
          Não lidas
        </Button>
      </div>

      {/* Lista */}
      {error ? (
        <ErrorState message={error} onRetry={reset} />
      ) : isLoading ? (
        <div className="bento-card-static overflow-hidden">
          <div className="accent-bar" />
          <div className="divide-y divide-border/50">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-start gap-3 p-4">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bento-card-static overflow-hidden">
          <div className="accent-bar" />
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Bell className="h-12 w-12 mb-4 opacity-30" />
            <p className="font-display font-semibold text-lg">
              {filter === "unread"
                ? "Nenhuma notificação não lida"
                : "Nenhuma notificação"}
            </p>
            <p className="text-sm mt-1 opacity-60">
              {filter === "unread"
                ? "Você leu todas as suas notificações!"
                : "Você ainda não recebeu notificações."}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="bento-card-static overflow-hidden">
            <div className="accent-bar" />
            <motion.div
              className="divide-y divide-border/50"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {notifications.map((notification) => (
                <motion.div key={notification.id} variants={itemVariants}>
                  <NotificationItem
                    notification={notification}
                    onRead={handleMarkAsRead}
                    showMarkAsRead
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
          <div ref={sentinelRef} />
          {isLoadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
