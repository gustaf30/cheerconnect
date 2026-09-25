import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";

// Precedência equivalente à do Next.js, com o shell no topo:
// shell > .env.local > .env
const fromShell = { ...process.env };
dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });
dotenv.config({
  path: path.join(process.cwd(), ".env.local"),
  override: true,
  quiet: true,
});
Object.assign(process.env, fromShell);

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required");
}

const vitestCli = path.join(process.cwd(), "node_modules", "vitest", "vitest.mjs");

const child = spawn(
  process.execPath,
  [vitestCli, "run", "src/__tests__/realtime-redis.integration.test.ts"],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      RUN_REALTIME_TESTS: "true",
      REALTIME_BUS_TRANSPORT: "redis",
      REALTIME_STREAM_KEY: `cheerconnect:test:realtime:${randomBytes(6).toString("hex")}`,
    },
  }
);

child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
