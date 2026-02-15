-- CreateIndex
CREATE INDEX "Notification_userId_type_idx" ON "Notification"("userId", "type");

-- CreateIndex
CREATE INDEX "Post_originalPostId_authorId_idx" ON "Post"("originalPostId", "authorId");
