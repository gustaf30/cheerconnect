"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { scaleIn, noMotion, springs } from "@/lib/animations";

export function MessageButton() {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/messages/count");
      if (!response.ok) return;

      const data = await response.json();
      setUnreadCount(data.count);
    } catch {
      // Falhar silenciosamente
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();

    // Polling para atualizações
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const shouldReduceMotion = useReducedMotion();
  const badgeVariants = shouldReduceMotion ? noMotion : scaleIn;

  return (
    <Link href="/messages">
      <Button variant="ghost" size="icon" className="relative" aria-label="Mensagens">
        <MessageSquare className="h-5 w-5" />
        <AnimatePresence mode="wait">
          {unreadCount > 0 && (
            <motion.span
              key={unreadCount}
              className={cn(
                "absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full",
                "bg-primary text-primary-foreground text-xs font-medium",
                "flex items-center justify-center"
              )}
              variants={badgeVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={shouldReduceMotion ? undefined : springs.snappy}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
    </Link>
  );
}
