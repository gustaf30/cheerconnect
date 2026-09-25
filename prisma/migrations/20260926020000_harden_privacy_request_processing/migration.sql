ALTER TABLE "PrivacyRequest"
ADD COLUMN "processingStartedAt" TIMESTAMP(3),
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastError" TEXT;

CREATE INDEX "PrivacyRequest_status_processingStartedAt_idx"
ON "PrivacyRequest"("status", "processingStartedAt");
