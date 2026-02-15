import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Returns true after hydration (client-side only).
 * Uses useSyncExternalStore to avoid the setState-in-effect lint error.
 */
export function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}
