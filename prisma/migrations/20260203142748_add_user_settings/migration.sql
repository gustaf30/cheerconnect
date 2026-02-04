-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'CONNECTIONS_ONLY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyCommentReplied" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyConnectionAccepted" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyConnectionRequest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyPostCommented" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyPostLiked" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "showEmail" BOOLEAN NOT NULL DEFAULT false;
