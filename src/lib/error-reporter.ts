/**
 * Centralized error reporting utility.
 * Wraps console.error with structured context.
 * Ready for future Sentry/LogRocket integration.
 */
export function reportError(error: unknown, context?: string): void {
  const prefix = context ? `[${context}]` : "[Error]";

  if (error instanceof Error) {
    console.error(prefix, error.message, error.stack);
  } else {
    console.error(prefix, error);
  }

  // TODO: Future Sentry integration
  // if (typeof window !== 'undefined') {
  //   Sentry.captureException(error, { tags: { context } });
  // }
}
