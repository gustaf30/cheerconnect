// O output "standalone" não inclui .next/static, então o bundle serviria as
// páginas sem o CSS/JS e quebraria em runtime. O Dockerfile faz o mesmo
// (COPY .next/static), mas para quem roda direto no repositório isso precisa
// acontecer depois do build.
import { cp, mkdir, access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const source = path.join(root, ".next", "static");
const target = path.join(root, ".next", "standalone", ".next", "static");

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(source))) {
    console.error(`Bundle standalone incompleto: ${source} nao existe. Rode "next build" antes.`);
    process.exitCode = 1;
    return;
  }
  if (await exists(target)) {
    console.log("prepare-standalone: .next/static ja estava no bundle.");
    return;
  }

  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { recursive: true });
  console.log("prepare-standalone: .next/static copiado para o bundle standalone.");
}

main().catch((error) => {
  console.error("prepare-standalone falhou:", error?.message ?? error);
  process.exitCode = 1;
});
