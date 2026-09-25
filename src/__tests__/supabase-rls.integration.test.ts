// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const enabled = process.env.RUN_RLS_TESTS === "true" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("Supabase RLS baseline", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it("enables RLS on every public application table", async () => {
    const result = await client.query(
      "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_prisma_migrations' AND NOT c.relrowsecurity ORDER BY c.relname"
    );

    expect(result.rows).toEqual([]);
  });

  it("restricts every application policy to the dedicated runtime role", async () => {
    const result = await client.query(
      "SELECT count(*)::int AS total, count(*) FILTER (WHERE roles = ARRAY['cheerconnect_app']::name[])::int AS restricted FROM pg_policies WHERE schemaname = 'public'"
    );

    expect(result.rows[0]).toEqual({ total: 30, restricted: 30 });
  });
});
