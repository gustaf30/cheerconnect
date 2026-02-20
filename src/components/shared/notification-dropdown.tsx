"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Bell, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NotificationItem, type Notification } from "./notification-item";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fadeSlideUp,
  noMotion,
  noMotionContainer,
  staggerContainer,
  stagger,
} from "@/lib/animations";
import { reportError } from "@/lib/error-reporter";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/hooks/use-realtime";

interface NotificationDropdownProps {
  variant?: "icon" | "sidebar";
}

export function NotificationDropdown({ variant = "icon" }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const { notificationCount } = useRealtime();
  const [localCountOffset, setLocalCountOffset] = useState(0);
  const prevSseCountRef = useRef(notificationCount);

  // Reset local offset when SSE count changes (server caught up)
  useEffect(() => {
    if (notificationCount !== prevSseCountRef.current) {
      prevSseCountRef.current = notificationCount;
      setLocalCountOffset(0);
    }
  }, [notificationCount]);

  const effectiveCount = Math.max(0, notificationCount - localCountOffset);

  const itemVariants = shouldReduceMotion ? noMotion : fadeSlideUp;
  const containerVariants = shouldReduceMotion
    ? noMotionContainer
    : staggerContainer(stagger.fast);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/notifications?limit=20");
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
      }
    } catch (error) {
      reportError(error, "NotificationDropdown.fetchNotifications");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Buscar notificações quando o dropdown abre
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setLocalCountOffset((prev) => prev + 1);
    } catch (error) {
      reportError(error, "NotificationDropdown.markAsRead");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setLocalCountOffset(notificationCount);
    } catch (error) {
      reportError(error, "NotificationDropdown.markAllAsRead");
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <PopoverTrigger asChild>
        {variant === "sidebar" ? (
          <button
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-base cursor-pointer w-full relative"
            aria-label="Notificações"
          >
            <div className="relative">
              <Bell className="h-5 w-5" />
              <span aria-live="polite" aria-atomic="true">
                {effectiveCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {effectiveCount > 9 ? "9+" : effectiveCount}
                  </span>
                )}
              </span>
            </div>
            <span>Notificações</span>
          </button>
        ) : (
          <Button variant="ghost" size="icon" className="relative hover:bg-accent/80 transition-slow" aria-label="Notificações">
            <Bell className="h-5 w-5" />
            <span aria-live="polite" aria-atomic="true">
              {effectiveCount > 0 && (
                <>
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary animate-ping opacity-75" />
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary animate-pulse-ring" />
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-primary to-[oklch(0.45_0.20_25)] text-primary-foreground text-xs flex items-center justify-center font-medium shadow-md">
                    {effectiveCount > 9 ? "9+" : effectiveCount}
                  </span>
                </>
              )}
            </span>
            <span className="sr-only">Notificações</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align={variant === "sidebar" ? "start" : "end"} side={variant === "sidebar" ? "right" : "bottom"} className={cn(
        "w-96 p-0 animate-scale-in !rounded-[1.25rem]",
        variant !== "sidebar" && "overflow-hidden"
      )}>
        {/* Arrow connector — sidebar variant only */}
        {variant === "sidebar" && (
          <div
            className="absolute -left-[5px] top-5 h-3 w-3 rotate-45 bg-popover border-l border-b border-border"
            aria-hidden="true"
          />
        )}

        <div className={variant === "sidebar" ? "overflow-hidden rounded-[inherit]" : undefined}>
        <div className="accent-bar" />
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <h3 className="font-display font-semibold text-gradient-primary">Notificações</h3>
          {effectiveCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs hover:bg-primary/10 hover:text-primary transition-fast"
              onClick={handleMarkAllAsRead}
            >
              <Check className="h-3 w-3 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground animate-fade-in">
              <Bell className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">Nenhuma notificação</p>
              <p className="text-xs mt-1 opacity-60">Você está em dia!</p>
            </div>
          ) : (
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
                    onNavigate={() => setIsOpen(false)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </ScrollArea>

        {/* Ver mais */}
        {!isLoading && notifications.length > 0 && (
          <div className="border-t border-border/50 px-4 py-2.5">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-fast"
            >
              Ver todas as notificações
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
