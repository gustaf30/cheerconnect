import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const apiRoot = join(root, "src", "app", "api");
const specPath = join(root, "public", "openapi.json");

async function routeFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await routeFiles(fullPath)));
    if (entry.isFile() && entry.name === "route.ts") files.push(fullPath);
  }
  return files;
}

function routePath(file) {
  const directory = relative(apiRoot, file).replace(/route\.ts$/, "").split(sep).join("/");
  const segments = directory.split("/").filter(Boolean).map((segment) => {
    if (segment.startsWith("[...")) return null;
    return segment.replace(/^\[([^\]]+)\]$/, "{$1}");
  }).filter(Boolean);
  return `/api/${segments.join("/")}`;
}

function methods(source) {
  return [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((match) => match[1]);
}

function operation(method, route) {
  const isCron = route.startsWith("/api/cron");
  const isPublic = route === "/api/docs" || route.startsWith("/api/auth") || route.startsWith("/api/health");
  return {
    tags: [route.split("/")[2] || "API"],
    summary: `${method} ${route}`,
    ...(isCron ? { security: [{ cronBearer: [] }] } : isPublic ? { security: [] } : {}),
    responses: {
      "200": { description: "Successful response" },
      ...(isPublic ? {} : { "401": { $ref: "#/components/responses/Unauthorized" } }),
    },
  };
}

const spec = JSON.parse(await readFile(specPath, "utf8"));
const files = await routeFiles(apiRoot);
let added = 0;

for (const file of files) {
  const route = routePath(file);
  if (route === "/api" || route.includes("/api/[")) continue;
  const source = await readFile(file, "utf8");
  const routeMethods = methods(source);
  if (routeMethods.length === 0) continue;
  spec.paths[route] ||= {};
  for (const method of routeMethods) {
    if (!spec.paths[route][method.toLowerCase()]) {
      spec.paths[route][method.toLowerCase()] = operation(method, route);
      added += 1;
    }
  }
}

await writeFile(specPath, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`OpenAPI sincronizado: ${added} operação(ões) adicionada(s), ${Object.keys(spec.paths).length} paths.`);
