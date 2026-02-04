-- AlterTable: Add updatedAt column with default value for existing rows
ALTER TABLE "Comment" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Update existing rows to use createdAt as updatedAt
UPDATE "Comment" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

-- Make the column NOT NULL
ALTER TABLE "Comment" ALTER COLUMN "updatedAt" SET NOT NULL;
