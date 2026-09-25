DO $$
BEGIN
  CREATE TYPE "MediaAssetStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "MediaPurpose" AS ENUM ('POST', 'AVATAR', 'BANNER', 'TEAM_LOGO', 'TEAM_BANNER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "PrivacyRequestType" AS ENUM ('EXPORT', 'DELETE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "PrivacyRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Team"
  ADD COLUMN IF NOT EXISTS "logoPublicId" TEXT,
  ADD COLUMN IF NOT EXISTS "bannerPublicId" TEXT;

ALTER TABLE "TeamMember"
  ADD COLUMN IF NOT EXISTS "canEdit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canPost" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canInvite" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canManageMembers" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canDeleteTeam" BOOLEAN NOT NULL DEFAULT false;

UPDATE "TeamMember"
SET "canEdit" = "hasPermission",
    "canPost" = "hasPermission",
    "canInvite" = "hasPermission",
    "canManageMembers" = "isAdmin",
    "canDeleteTeam" = "isAdmin"
WHERE "isActive" = true;

UPDATE "TeamMember"
SET "hasPermission" = true,
    "canEdit" = true,
    "canPost" = true,
    "canInvite" = true,
    "canManageMembers" = true,
    "canDeleteTeam" = true
WHERE "isAdmin" = true AND "isActive" = true;

ALTER TABLE "TeamInvite"
  ADD COLUMN IF NOT EXISTS "canEdit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canPost" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canInvite" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canManageMembers" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canDeleteTeam" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "invitedById" TEXT;
CREATE INDEX IF NOT EXISTS "TeamInvite_invitedById_idx" ON "TeamInvite"("invitedById");
UPDATE "TeamInvite" SET "status" = 'EXPIRED' WHERE "invitedById" IS NULL AND "status" = 'PENDING';

ALTER TABLE "Report"
  ADD COLUMN IF NOT EXISTS "moderatorId" TEXT,
  ADD COLUMN IF NOT EXISTS "resolutionNote" TEXT,
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);

ALTER TABLE "ActivityLog"
  ALTER COLUMN "actorId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "retentionUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "anonymizedAt" TIMESTAMP(3);

ALTER TABLE "Connection" ADD COLUMN IF NOT EXISTS "pairKey" TEXT;
UPDATE "Connection"
SET "pairKey" = LEAST("senderId", "receiverId") || ':' || GREATEST("senderId", "receiverId")
WHERE "pairKey" IS NULL;
DROP TABLE IF EXISTS "_duplicate_connections";
CREATE TEMP TABLE "_duplicate_connections" ON COMMIT DROP AS
SELECT c."id" AS "id", keeper."id" AS "keepId", c."pairKey" AS "pairKey"
FROM "Connection" c
JOIN (
  SELECT DISTINCT ON ("pairKey") "id", "pairKey"
  FROM "Connection"
  WHERE "pairKey" IS NOT NULL
  ORDER BY "pairKey",
    CASE "status" WHEN 'ACCEPTED' THEN 0 WHEN 'PENDING' THEN 1 ELSE 2 END,
    "createdAt" ASC,
    "id" ASC
) keeper ON keeper."pairKey" = c."pairKey"
WHERE c."id" <> keeper."id";
DELETE FROM "Connection" c
USING "_duplicate_connections" d
WHERE c."id" = d."id";
DROP TABLE IF EXISTS "_duplicate_connections";
ALTER TABLE "Connection" ALTER COLUMN "pairKey" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Connection_pairKey_key" ON "Connection"("pairKey");

ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "pairKey" TEXT;
UPDATE "Conversation"
SET "pairKey" = LEAST("participant1Id", "participant2Id") || ':' || GREATEST("participant1Id", "participant2Id")
WHERE "pairKey" IS NULL;
DROP TABLE IF EXISTS "_duplicate_conversations";
CREATE TEMP TABLE "_duplicate_conversations" ON COMMIT DROP AS
SELECT c."id" AS "id", keeper."id" AS "keepId", c."pairKey" AS "pairKey"
FROM "Conversation" c
JOIN (
  SELECT DISTINCT ON ("pairKey") "id", "pairKey"
  FROM "Conversation"
  WHERE "pairKey" IS NOT NULL
  ORDER BY "pairKey", COALESCE("lastMessageAt", "createdAt") DESC, "createdAt" ASC, "id" ASC
) keeper ON keeper."pairKey" = c."pairKey"
WHERE c."id" <> keeper."id";
UPDATE "Message" m
SET "conversationId" = d."keepId"
FROM "_duplicate_conversations" d
WHERE m."conversationId" = d."id";
UPDATE "Notification" n
SET "relatedId" = d."keepId"
FROM "_duplicate_conversations" d
WHERE n."relatedType" = 'conversation' AND n."relatedId" = d."id";
DELETE FROM "Conversation" c
USING "_duplicate_conversations" d
WHERE c."id" = d."id";
UPDATE "Conversation" c
SET "lastMessageAt" = latest."createdAt",
    "lastMessagePreview" = LEFT(latest."content", 53)
FROM (
  SELECT DISTINCT ON ("conversationId") "conversationId", "createdAt", "content"
  FROM "Message"
  ORDER BY "conversationId", "createdAt" DESC, "id" DESC
) latest
WHERE c."id" = latest."conversationId";
DROP TABLE IF EXISTS "_duplicate_conversations";
ALTER TABLE "Conversation" ALTER COLUMN "pairKey" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_pairKey_key" ON "Conversation"("pairKey");

CREATE TABLE IF NOT EXISTS "MediaAsset" (
  "id" TEXT NOT NULL,
  "url" TEXT,
  "publicId" TEXT,
  "ownerId" TEXT,
  "postId" TEXT,
  "teamId" TEXT,
  "purpose" "MediaPurpose" NOT NULL,
  "resourceType" TEXT NOT NULL,
  "mimeType" TEXT,
  "bytes" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "status" "MediaAssetStatus" NOT NULL DEFAULT 'PENDING',
  "uploadTokenHash" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MediaAsset_url_key" ON "MediaAsset"("url");
CREATE INDEX IF NOT EXISTS "MediaAsset_ownerId_purpose_status_idx" ON "MediaAsset"("ownerId", "purpose", "status");
CREATE INDEX IF NOT EXISTS "MediaAsset_postId_idx" ON "MediaAsset"("postId");
CREATE INDEX IF NOT EXISTS "MediaAsset_teamId_idx" ON "MediaAsset"("teamId");
CREATE INDEX IF NOT EXISTS "MediaAsset_status_createdAt_idx" ON "MediaAsset"("status", "createdAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MediaAsset_ownerId_fkey') THEN
    ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MediaAsset_postId_fkey') THEN
    ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MediaAsset_teamId_fkey') THEN
    ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "PrivacyRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "PrivacyRequestType" NOT NULL,
  "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PrivacyRequest_userId_status_idx" ON "PrivacyRequest"("userId", "status");
CREATE INDEX IF NOT EXISTS "PrivacyRequest_status_requestedAt_idx" ON "PrivacyRequest"("status", "requestedAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrivacyRequest_userId_fkey') THEN
    ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "Report_moderatorId_idx" ON "Report"("moderatorId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Report_moderatorId_fkey') THEN
    ALTER TABLE "Report" ADD CONSTRAINT "Report_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamInvite_invitedById_fkey') THEN
    ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
