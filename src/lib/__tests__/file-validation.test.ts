import { describe, expect, it } from "vitest";
import { validateFileType } from "@/lib/file-validation";

function png(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

describe("file validation", () => {
  it("accepts a PNG and reads its dimensions", () => {
    const result = validateFileType(png(320, 180));
    expect(result).toMatchObject({ valid: true, detectedType: "image", mimeType: "image/png", width: 320, height: 180 });
  });

  it("rejects SVG even when the client claims an image MIME type", () => {
    const result = validateFileType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"));
    expect(result.valid).toBe(false);
  });

  it("rejects a file with an allowed extension but invalid bytes", () => {
    const result = validateFileType(Buffer.from("not really a png"));
    expect(result.valid).toBe(false);
  });
});
