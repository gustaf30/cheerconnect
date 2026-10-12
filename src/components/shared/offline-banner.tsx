"use client";

import { useEffect, useState } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const { isOffline } = useRealtime();
  // Revalida no próprio componente: o flag do hook pode ficar preso
  // (navegador reportando offline, evento 'offline' espúrio). Se o
  // servidor responde, há conexão e a faixa não deve aparecer.
  const [serverReachable, setServerReachable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isOffline) {
      setServerReachable(null);
      return;
    }
    let cancelled = false;
    fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(5000) })
      .then(() => {
        if (!cancelled) setServerReachable(true);
      })
      .catch(() => {
        if (!cancelled) setServerReachable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOffline]);

  if (!isOffline || serverReachable) return null;

  return (
    <aside aria-label="Status de conexão" className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-amber-950 text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 safe-area-top animate-slide-up">
      <WifiOff className="size-4" />
      <span>Sem conexão com a internet</span>
    </aside>
  );
}
