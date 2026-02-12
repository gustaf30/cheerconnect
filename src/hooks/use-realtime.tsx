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

interface RealtimeState {
  notificationCount: number;
  messageCount: number;
  lastMessageAt: string | null;
}

const defaultState: RealtimeState = {
  notificationCount: 0,
  messageCount: 0,
  lastMessageAt: null,
};

const RealtimeContext = createContext<RealtimeState>(defaultState);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [state, setState] = useState<RealtimeState>(defaultState);
  const retryDelayRef = useRef(1000);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    const connect = () => {
      const es = new EventSource("/api/notifications/stream");
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
        retryTimeoutRef.current = setTimeout(() => {
          retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30000);
          connect();
        }, retryDelayRef.current);
      };
    };

    connect();

    return () => {
      eventSourceRef.current?.close();
      clearTimeout(retryTimeoutRef.current);
    };
  }, [status]);

  return (
    <RealtimeContext.Provider value={state}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
