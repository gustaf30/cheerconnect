DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cheerconnect_app') THEN
    CREATE ROLE cheerconnect_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$role$;

GRANT USAGE ON SCHEMA public TO cheerconnect_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cheerconnect_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cheerconnect_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cheerconnect_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO cheerconnect_app;

CREATE POLICY cheerconnect_runtime_access ON "User" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "Account" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "Session" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "VerificationToken" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "CareerHistory" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "Achievement" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "Connection" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "Post" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "PostEdit" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "Tag" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "PostTag" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "Mention" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "Comment" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "CommentLike" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "Like" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "Team" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "TeamMember" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "TeamFollow" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "TeamAchievement" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "TeamInvite" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "Event" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "Notification" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "Conversation" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "Message" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "Report" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "Block" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "ActivityLog" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "MediaAsset" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "AccountReauthChallenge" TO cheerconnect_app USING (true) WITH CHECK (true);
CREATE POLICY cheerconnect_runtime_access ON "PrivacyRequest" TO cheerconnect_app USING (true) WITH CHECK (true);
