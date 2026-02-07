-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyPostReposted" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyTeamInvite" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Achievement_userId_idx" ON "Achievement"("userId");

-- CreateIndex
CREATE INDEX "CareerHistory_userId_idx" ON "CareerHistory"("userId");

-- CreateIndex
CREATE INDEX "Connection_senderId_status_idx" ON "Connection"("senderId", "status");

-- CreateIndex
CREATE INDEX "Connection_receiverId_status_idx" ON "Connection"("receiverId", "status");

-- CreateIndex
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE INDEX "Like_postId_idx" ON "Like"("postId");

-- CreateIndex
CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");

-- CreateIndex
CREATE INDEX "Post_teamId_idx" ON "Post"("teamId");

-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");
