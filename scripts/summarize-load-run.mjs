// Detalha a distribuicao de uma execucao: percentis por metrica e o efeito do
// cold start, comparando a janela de aquecimento (partida) com a janela medida
// (regime). E o que permite dizer se o p95 de producao e arquitetura ou partida.

import { readFile } from "node:fs/promises";

const file = process.argv[2];
const data = JSON.parse(await readFile(file, "utf8"));
const metrics = data.metrics || {};

const wanted = [
  ["leitura API (regime)", "http_req_duration{scenario:read,kind:api}"],
  ["partida API (frio)", "http_req_duration{scenario:warmup,kind:api}"],
  ["paginas (regime)", "http_req_duration{scenario:read,kind:page}"],
  ["partida paginas", "http_req_duration{scenario:warmup,kind:page}"],
  ["auth", "http_req_duration{scenario:auth,kind:api}"],
];

const cols = ["min", "med", "avg", "p(90)", "p(95)", "p(99)", "max"];
console.log("metrica".padEnd(22) + cols.map((c) => c.padStart(9)).join(""));
console.log("-".repeat(22 + cols.length * 9));

for (const [label, name] of wanted) {
  const m = metrics[name]?.values;
  if (!m) {
    console.log(`${label.padEnd(22)}${"(ausente)".padStart(9)}`);
    continue;
  }
  const cells = cols.map((c) => `${Math.round(m[c] ?? 0)}ms`.padStart(9));
  console.log(label.padEnd(22) + cells.join(""));
}

console.log("\nquantidade de requisicoes por metrica:");
for (const [label, name] of wanted) {
  const c = metrics[name]?.values?.count;
  if (c !== undefined) console.log(`  ${label.padEnd(22)} ${c}`);
}
