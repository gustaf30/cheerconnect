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

const tsxCli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
const probe = path.join(process.cwd(), "scripts", "realtime-instance-probe.ts");
const targetUserId = `cross-instance-${randomBytes(6).toString("hex")}`;

const childEnv = {
  ...process.env,
  REALTIME_BUS_TRANSPORT: "redis",
  REALTIME_SIGNAL_INTERVAL_MS: "300",
  REALTIME_STREAM_KEY: `cheerconnect:test:cross:${randomBytes(4).toString("hex")}`,
  TARGET_USER_ID: targetUserId,
  PROBE_TIMEOUT_MS: "30000",
};

function launch(role) {
  let markReady;
  let markReceived;
  const ready = new Promise((resolve) => {
    markReady = resolve;
  });
  const received = new Promise((resolve) => {
    markReceived = resolve;
  });

  const child = spawn(process.execPath, [tsxCli, probe, role], {
    cwd: process.cwd(),
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  child.stdout.on("data", (chunk) => {
    const text = String(chunk);
    process.stdout.write(`[${role}] ${text}`);
    if (text.includes("READY")) markReady();
    if (text.includes("RECEIVED")) markReceived();
  });
  child.stderr.on("data", (chunk) => process.stderr.write(`[${role}!] ${chunk}`));

  const exited = new Promise((resolve) => child.once("exit", resolve));
  return { role, ready, received, exited };
}

const instances = [launch("instancia-1"), launch("instancia-2")];

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(`timeout:${label}`), ms)),
  ]);

const readyResult = await withTimeout(
  Promise.all(instances.map((instance) => instance.ready)),
  30000,
  "ready"
);

if (readyResult === "timeout:ready") {
  console.error("Alguma instância não assinou o barramento a tempo.");
  process.exit(1);
}

// Margem para o cursor do pump ser inicializado a partir da cauda do stream
// antes de qualquer evento ser publicado.
await new Promise((resolve) => setTimeout(resolve, 1500));

const publisher = launch("publish");
const published = await withTimeout(publisher.exited, 20000, "publish");
if (published === "timeout:publish") {
  console.error("O processo publicador não concluiu.");
  process.exit(1);
}

const delivery = await withTimeout(
  Promise.all(instances.map((instance) => instance.received)),
  30000,
  "delivery"
);

if (delivery === "timeout:delivery") {
  console.error("FALHA: as instâncias não receberam o evento a tempo.");
  process.exit(1);
}

const exitCodes = await withTimeout(
  Promise.all(instances.map((instance) => instance.exited)),
  15000,
  "exit"
);

const failed =
  Array.isArray(exitCodes) && exitCodes.some((code) => code !== 0);

if (failed) {
  console.error(`FALHA: uma instância saiu com erro: ${JSON.stringify(exitCodes)}`);
  process.exit(1);
}

console.log(
  "OK: as 2 instâncias receberam um evento publicado por um terceiro processo."
);

const unreachableEnv = {
  UPSTASH_REDIS_REST_URL: "http://127.0.0.1:1",
  UPSTASH_REDIS_REST_TOKEN: "token-inexistente",
  REALTIME_STREAM_KEY: `${childEnv.REALTIME_STREAM_KEY}:indisponivel`,
};

const degraded = spawn(process.execPath, [tsxCli, probe, "local"], {
  cwd: process.cwd(),
  env: { ...unreachableEnv, TARGET_USER_ID: targetUserId, PROBE_TIMEOUT_MS: "20000" },
  stdio: ["ignore", "pipe", "pipe"],
  shell: false,
});

let degradedOut = "";
degraded.stdout.on("data", (chunk) => {
  degradedOut += String(chunk);
});
degraded.stderr.on("data", () => {});

const degradedCode = await new Promise((resolve) =>
  degraded.once("exit", resolve)
);

if (degradedCode === 0 && degradedOut.includes("RECEIVED")) {
  console.log(
    "OK: com o Redis inacessível o evento ainda é entregue no mesmo processo."
  );
} else {
  console.error(
    `FALHA: degradação sem Redis não preservou a entrega local (código ${degradedCode}).`
  );
  process.exit(1);
}
