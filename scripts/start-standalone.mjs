// Com output "standalone" o Next.js recusa "next start"; o servidor e o
// .next/standalone/server.js. Este wrapper roda esse servidor, preservando o
// --max-http-header-size que o start usava (necessario para cookies de sessao
// grandes) e repassando os argumentos do usuario.
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const server = path.join(root, ".next", "standalone", "server.js");

try {
  await access(server);
} catch {
  console.error(
    [
      "Bundle standalone ausente.",
      'Rode "npm run build" antes de "npm start".',
      "Alternativa: use o container, que faz esse passo no Dockerfile:",
      "  docker compose up --build",
    ].join("\n")
  );
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ["--max-http-header-size=32768", server, ...process.argv.slice(2)],
  {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: false,
  }
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.once("exit", (code, signal) => {
  process.exitCode = typeof code === "number" ? code : signal ? 1 : 0;
});
