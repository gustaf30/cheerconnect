-- Enable trigram extension for ILIKE optimization
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes with trigram ops for fast ILIKE '%query%' searches
-- These indexes are used transparently by PostgreSQL's query planner
CREATE INDEX IF NOT EXISTS "idx_user_name_trgm" ON "User" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_user_username_trgm" ON "User" USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_post_content_trgm" ON "Post" USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_team_name_trgm" ON "Team" USING gin (name gin_trgm_ops);
