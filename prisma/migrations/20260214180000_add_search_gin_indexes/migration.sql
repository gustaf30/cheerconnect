-- Enable trigram extension for ILIKE optimization
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- GIN indexes with trigram ops for fast ILIKE '%query%' searches
-- These indexes are used transparently by PostgreSQL's query planner
CREATE INDEX IF NOT EXISTS "idx_user_name_trgm" ON "User" USING gin (name public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_user_username_trgm" ON "User" USING gin (username public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_post_content_trgm" ON "Post" USING gin (content public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_team_name_trgm" ON "Team" USING gin (name public.gin_trgm_ops);
