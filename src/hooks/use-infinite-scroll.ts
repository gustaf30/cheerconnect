"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from "react";

interface UseInfiniteScrollOptions<T> {
  fetchFn: (cursor: string | null) => Promise<{ items: T[]; nextCursor: string | null }>;
  enabled?: boolean;
  rootMargin?: string;
}

interface UseInfiniteScrollReturn<T> {
  items: T[];
  setItems: Dispatch<SetStateAction<T[]>>;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  reset: () => void;
}

export function useInfiniteScroll<T>({
  fetchFn,
  enabled = true,
  rootMargin = "200px",
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchInitial = useCallback(async () => {
    const id = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    cursorRef.current = null;

    try {
      const data = await fetchFn(null);
      if (id !== requestIdRef.current) return;
      setItems(data.items);
      cursorRef.current = data.nextCursor;
      setHasMore(!!data.nextCursor);
    } catch {
      if (id !== requestIdRef.current) return;
      setError("Erro ao carregar dados");
    } finally {
      if (id === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchFn]);

  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current || !cursorRef.current) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    const id = requestIdRef.current;

    try {
      const data = await fetchFn(cursorRef.current);
      if (id !== requestIdRef.current) return;
      setItems((prev) => [...prev, ...data.items]);
      cursorRef.current = data.nextCursor;
      setHasMore(!!data.nextCursor);
    } catch {
      if (id !== requestIdRef.current) return;
      // Manter itens existentes visíveis em caso de erro ao carregar mais
    } finally {
      if (id === requestIdRef.current) {
        setIsLoadingMore(false);
        isLoadingMoreRef.current = false;
      }
    }
  }, [fetchFn]);

  // Busca inicial
  useEffect(() => {
    if (enabled) {
      fetchInitial();
    }
  }, [enabled, fetchInitial]);

  // IntersectionObserver para scroll infinito
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursorRef.current && !isLoadingMoreRef.current) {
          loadMore();
        }
      },
      { rootMargin }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, loadMore, rootMargin]);

  const reset = useCallback(() => {
    requestIdRef.current++;
    isLoadingMoreRef.current = false;
    fetchInitial();
  }, [fetchInitial]);

  return {
    items,
    setItems,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    sentinelRef,
    reset,
  };
}
