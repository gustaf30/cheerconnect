"use client";

import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { scaleIn, noMotion, springs } from "@/lib/animations";
import { useRealtime } from "@/hooks/use-realtime";

export function MessageButton() {
  const { messageCount } = useRealtime();
  const shouldReduceMotion = useReducedMotion();
  const badgeVariants = shouldReduceMotion ? noMotion : scaleIn;

  return (
    <Link href="/messages">
      <Button variant="ghost" size="icon" className="relative" aria-label="Mensagens">
        <MessageSquare className="h-5 w-5" />
        <AnimatePresence mode="wait">
          {messageCount > 0 && (
            <motion.span
              key={messageCount}
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
              {messageCount > 99 ? "99+" : messageCount}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
    </Link>
  );
}
