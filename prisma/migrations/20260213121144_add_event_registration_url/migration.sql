-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "registrationUrl" TEXT;

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "Like_userId_idx" ON "Like"("userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_senderId_isRead_idx" ON "Message"("conversationId", "senderId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "TeamFollow_teamId_idx" ON "TeamFollow"("teamId");
