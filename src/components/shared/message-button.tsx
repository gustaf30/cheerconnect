"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MessageButton() {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/messages/count");
      if (!response.ok) return;

      const data = await response.json();
      setUnreadCount(data.count);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();

    // Poll for updates
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  return (
    <Link href="/messages">
      <Button variant="ghost" size="icon" className="relative">
        <MessageSquare className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full",
              "bg-primary text-primary-foreground text-xs font-medium",
              "flex items-center justify-center"
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>
    </Link>
  );
}
