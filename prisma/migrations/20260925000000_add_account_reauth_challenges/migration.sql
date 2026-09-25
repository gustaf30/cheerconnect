CREATE TYPE "AccountReauthPurpose" AS ENUM ('ACCOUNT_DELETION');

CREATE TABLE "AccountReauthChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" "AccountReauthPurpose" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenVersion" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountReauthChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountReauthChallenge_tokenHash_key" ON "AccountReauthChallenge"("tokenHash");
CREATE INDEX "AccountReauthChallenge_userId_purpose_expiresAt_idx" ON "AccountReauthChallenge"("userId", "purpose", "expiresAt");
CREATE INDEX "AccountReauthChallenge_purpose_verifiedAt_consumedAt_idx" ON "AccountReauthChallenge"("purpose", "verifiedAt", "consumedAt");
ALTER TABLE "AccountReauthChallenge" ADD CONSTRAINT "AccountReauthChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivacyRequest" ADD COLUMN "reauthVerifiedAt" TIMESTAMP(3);
