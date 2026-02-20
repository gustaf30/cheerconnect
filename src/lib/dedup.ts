/**
 * Client-side submission deduplication guard.
 * Prevents double-submits from rapid taps/clicks on mobile.
 */

const DEDUP_WINDOW_MS = 5000; // 5 segundos

let lastSubmission: { hash: string; timestamp: number } | null = null;

function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

/**
 * Check if this submission is a duplicate of a recent one.
 * Returns true if the content was already submitted within the dedup window.
 */
export function isDuplicateSubmission(content: string): boolean {
  const hash = simpleHash(content.trim());
  const now = Date.now();

  if (
    lastSubmission &&
    lastSubmission.hash === hash &&
    now - lastSubmission.timestamp < DEDUP_WINDOW_MS
  ) {
    return true;
  }

  lastSubmission = { hash, timestamp: now };
  return false;
}
