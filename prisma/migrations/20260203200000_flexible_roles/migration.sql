-- Add new columns to TeamMember
ALTER TABLE "TeamMember" ADD COLUMN "hasPermission" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TeamMember" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Create temporary column for new role
ALTER TABLE "TeamMember" ADD COLUMN "role_new" TEXT;

-- Migrate data: Convert enum to string and set permissions based on old role
UPDATE "TeamMember" SET
  "role_new" = CASE
    WHEN "role" = 'OWNER' THEN 'Dono'
    WHEN "role" = 'ADMIN' THEN 'Administrador'
    WHEN "role" = 'COACH' THEN 'Técnico'
    WHEN "role" = 'ATHLETE' THEN 'Atleta'
    ELSE 'Atleta'
  END,
  "hasPermission" = CASE WHEN "role" IN ('OWNER', 'ADMIN') THEN true ELSE false END,
  "isAdmin" = CASE WHEN "role" = 'OWNER' THEN true ELSE false END;

-- Drop old column and rename new one
ALTER TABLE "TeamMember" DROP COLUMN "role";
ALTER TABLE "TeamMember" RENAME COLUMN "role_new" TO "role";
ALTER TABLE "TeamMember" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "TeamMember" ALTER COLUMN "role" SET DEFAULT 'Atleta';

-- Add new columns to TeamInvite
ALTER TABLE "TeamInvite" ADD COLUMN "hasPermission" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TeamInvite" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Create temporary column for new role in TeamInvite
ALTER TABLE "TeamInvite" ADD COLUMN "role_new" TEXT;

-- Migrate TeamInvite data
UPDATE "TeamInvite" SET
  "role_new" = CASE
    WHEN "role" = 'OWNER' THEN 'Dono'
    WHEN "role" = 'ADMIN' THEN 'Administrador'
    WHEN "role" = 'COACH' THEN 'Técnico'
    WHEN "role" = 'ATHLETE' THEN 'Atleta'
    ELSE 'Atleta'
  END,
  "hasPermission" = CASE WHEN "role" IN ('OWNER', 'ADMIN') THEN true ELSE false END,
  "isAdmin" = CASE WHEN "role" = 'OWNER' THEN true ELSE false END;

-- Drop old column and rename new one
ALTER TABLE "TeamInvite" DROP COLUMN "role";
ALTER TABLE "TeamInvite" RENAME COLUMN "role_new" TO "role";
ALTER TABLE "TeamInvite" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "TeamInvite" ALTER COLUMN "role" SET DEFAULT 'Atleta';

-- Drop the TeamRole enum (no longer needed)
DROP TYPE "TeamRole";
