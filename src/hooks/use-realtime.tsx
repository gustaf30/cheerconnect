"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";

interface RealtimeSSEState {
  notificationCount: number;
  messageCount: number;
  lastMessageAt: string | null;
}

interface RealtimeContextValue extends RealtimeSSEState {
  isOffline: boolean;
}

const defaultSSEState: RealtimeSSEState = {
  notificationCount: 0,
  messageCount: 0,
  lastMessageAt: null,
};

const defaultContextValue: RealtimeContextValue = {
  ...defaultSSEState,
  isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
};

const RealtimeContext = createContext<RealtimeContextValue>(defaultContextValue);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [state, setState] = useState<RealtimeSSEState>(defaultSSEState);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const retryDelayRef = useRef(1000);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    let isPageVisible = !document.hidden;

    const getStreamUrl = () => {
      const idle = !isPageVisible;
      return `/api/notifications/stream${idle ? "?idle=true" : ""}`;
    };

    const connect = () => {
      const es = new EventSource(getStreamUrl());
      eventSourceRef.current = es;

      es.onopen = () => {
        retryDelayRef.current = 1000;
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setState({
            notificationCount: data.notificationCount ?? 0,
            messageCount: data.messageCount ?? 0,
            lastMessageAt: data.lastMessageAt ?? null,
          });
        } catch {
          // Ignore parse errors (heartbeat comments don't trigger onmessage)
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        retryTimeoutRef.current = setTimeout(() => {
          retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30000);
          connect();
        }, retryDelayRef.current);
      };
    };

    connect();

    // Reconectar imediatamente quando a rede voltar
    const handleOnline = () => {
      setIsOffline(false);
      retryDelayRef.current = 1000;
      clearTimeout(retryTimeoutRef.current);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      connect();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    // Reconectar com param idle ao mudar visibilidade da aba
    const handleVisibilityChange = () => {
      const wasVisible = isPageVisible;
      isPageVisible = !document.hidden;

      if (wasVisible === isPageVisible) return;

      // Fechar conexão atual e reconectar com novo param idle
      clearTimeout(retryTimeoutRef.current);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      retryDelayRef.current = 1000;
      connect();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      eventSourceRef.current?.close();
      clearTimeout(retryTimeoutRef.current);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [status]);

  return (
    <RealtimeContext.Provider value={{ ...state, isOffline }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
