// Gera os .mmd a partir do codigo e renderiza todos para PNG.
//
// Reaproveita o Chromium que o Playwright ja instalou, para nao baixar um
// navegador so para isso. Se o caminho nao existir, cai no mmdc, que usa o
// Chromium que o puppeteer traria junto.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const MMR = "docs/diagrams";
const PNG = join(MMR, "png");

function acharChromium() {
  const base = join(process.env.LOCALAPPDATA || "", "ms-playwright");
  if (!existsSync(base)) return null;
  for (const dir of readdirSync(base)) {
    if (!dir.startsWith("chromium")) continue;
    for (const relativo of [
      ["chrome-win64", "chrome.exe"],
      ["chrome-win", "chrome.exe"],
      ["chrome-linux", "chrome"],
      ["chrome-mac", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"],
    ]) {
      const caminho = join(base, dir, ...relativo);
      if (existsSync(caminho)) return caminho;
    }
  }
  return null;
}

const cr = acharChromium();
if (cr) {
  process.env.PUPPETEER_EXECUTABLE_PATH = cr;
  console.log(` Chromium do Playwright: ${cr}`);
} else {
  console.log(" Chromium do Playwright nao encontrado; usando o do puppeteer.");
}

mkdirSync(PNG, { recursive: true });

console.log("\n Gerando os .mmd a partir do codigo:");
execFileSync(process.execPath, ["scripts/generate-diagrams.mjs"], { stdio: "inherit" });

const mmds = readdirSync(MMR).filter((f) => f.endsWith(".mmd")).sort();
console.log(`\n Renderizando ${mmds.length} diagramas:`);

let falhas = 0;
for (const nome of mmds) {
  const saida = join(PNG, nome.replace(/\.mmd$/, ".png"));
  rmSync(saida, { force: true });
  try {
    // No Windows o mmdc e um .cmd, que execFileSync nao executa sem shell.
    execFileSync("node_modules/.bin/mmdc.cmd", ["-i", join(MMR, nome), "-o", saida, "-b", "white", "-s", "2"], {
      stdio: ["ignore", "ignore", "inherit"],
      shell: true,
    });
    console.log(`  ok  ${nome.replace(/\.mmd$/, "")}`);
  } catch {
    console.log(`  FALHA  ${nome}`);
    falhas += 1;
  }
}

if (falhas) {
  console.error(`\n ${falhas} diagrama(s) nao renderizaram.`);
  process.exitCode = 1;
} else {
  console.log(`\n PNG em ${PNG}`);
}
