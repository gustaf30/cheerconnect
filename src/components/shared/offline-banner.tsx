"use client";

import { useRealtime } from "@/hooks/use-realtime";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const { isOffline } = useRealtime();

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-amber-950 text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 safe-area-top animate-slide-up">
      <WifiOff className="size-4" />
      <span>Sem conexão com a internet</span>
    </div>
  );
}
