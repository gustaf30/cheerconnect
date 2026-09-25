import logger from "@/lib/logger";

export type SecurityEventName =
  | "auth.login_failed"
  | "auth.email_unverified"
  | "auth.password_changed"
  | "user.blocked"
  | "user.unblocked"
  | "media.upload_rejected"
  | "privacy.export";

export function logSecurityEvent(
  event: SecurityEventName,
  metadata: Record<string, unknown> = {}
): void {
  logger.warn({ securityEvent: event, ...metadata }, `[security] ${event}`);
}
