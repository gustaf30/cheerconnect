import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  const spec = readFileSync(join(process.cwd(), "public", "openapi.json"), "utf-8");
  return new NextResponse(spec, {
    headers: { "Content-Type": "application/json" },
  });
}
