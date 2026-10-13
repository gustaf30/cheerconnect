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
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!isOffline) {
      setServerReachable(null);
      return;
    }
    let cancelled = false;
    const check = () => {
      setAttempts((n) => n + 1);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const controller = new AbortController();
        timer = setTimeout(() => controller.abort(), 8000);
        fetch("/api/health", { cache: "no-store", signal: controller.signal })
          .then(() => {
            if (!cancelled) setServerReachable(true);
          })
          .catch(() => {
            if (!cancelled) setServerReachable(false);
          })
          .finally(() => {
            if (timer) clearTimeout(timer);
          });
      } catch {
        if (timer) clearTimeout(timer);
        if (!cancelled) setServerReachable(false);
      }
    };
    check();
    // Repete enquanto o flag disser offline: uma sonda isolada pode
    // abortar (cold start) e travar a faixa para sempre.
    const interval = setInterval(check, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOffline]);

  if (!isOffline || serverReachable) return null;

  // DEBUG TEMPORÁRIO: expõe o estado real para diagnóstico.
  const onLine =
    typeof navigator !== "undefined" ? String(navigator.onLine) : "n/a";

  return (
    <aside aria-label="Status de conexão" className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-amber-950 text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 safe-area-top animate-slide-up">
      <WifiOff className="size-4" />
      <span>Sem conexão com a internet [dbg onLine={onLine} tries={attempts}]</span>
    </aside>
  );
}
