import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });
const vitest = path.join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
const child = spawn(process.execPath, [vitest, "run", "src/__tests__/cloudinary.integration.test.ts"], {
  cwd: process.cwd(),
  env: { ...process.env, RUN_CLOUDINARY_TESTS: "true" },
  stdio: "inherit",
  shell: false,
});
child.once("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
