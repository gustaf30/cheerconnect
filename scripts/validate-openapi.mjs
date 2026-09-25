import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const apiRoot = join(root, "src", "app", "api");
const spec = JSON.parse(await readFile(join(root, "public", "openapi.json"), "utf8"));

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(path)));
    if (entry.isFile() && entry.name === "route.ts") result.push(path);
  }
  return result;
}

function routePath(file) {
  const directory = relative(apiRoot, file).replace(/route\.ts$/, "").split(sep).join("/");
  const segments = directory.split("/").filter(Boolean).map((segment) => segment.startsWith("[...") ? null : segment.replace(/^\[([^\]]+)\]$/, "{$1}")).filter(Boolean);
  return `/api/${segments.join("/")}`;
}

const missing = [];
for (const file of await files(apiRoot)) {
  const route = routePath(file);
  if (route === "/api" || route.includes("/api/[")) continue;
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) {
    if (!spec.paths[route]?.[match[1].toLowerCase()]) missing.push(`${match[1]} ${route}`);
  }
}

if (missing.length > 0) {
  console.error(`OpenAPI ausente:\n${missing.join("\n")}`);
  process.exit(1);
}
console.log(`OpenAPI válido: ${Object.keys(spec.paths).length} paths cobertos.`);
