import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });

const source = process.env.DATABASE_URL;
if (!source) throw new Error("DATABASE_URL is required");

const schema = `cheerconnect_test_${randomBytes(6).toString("hex")}`;
const adminUrl = new URL(source);
adminUrl.port = "5432";
adminUrl.searchParams.delete("pgbouncer");
const testUrl = new URL(adminUrl.toString());
testUrl.searchParams.set("schema", schema);
testUrl.searchParams.set("options", `-c search_path="${schema}",public`);
const client = new Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 10000, query_timeout: 15000 });
let exitCode = 0;

const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
const vitestCli = path.join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
const run = (command, args, env) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: process.cwd(), env: { ...process.env, ...env }, stdio: "inherit", shell: false });
  child.once("error", reject);
  child.once("exit", (code) => resolve(code ?? 1));
});

try {
  await client.connect();
  await client.query(`CREATE SCHEMA "${schema}"`);
  exitCode = await run(process.execPath, [prismaCli, "migrate", "deploy"], { DATABASE_URL: testUrl.toString() });
  if (exitCode === 0) {
    exitCode = await run(process.execPath, [vitestCli, "run", "src/__tests__/postgres.integration.test.ts"], { DATABASE_URL: testUrl.toString(), RUN_DB_TESTS: "true" });
  }
} finally {
  if (client) {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
    await client.end().catch(() => {});
  }
}

process.exitCode = exitCode;
