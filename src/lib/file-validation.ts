/**
 * File validation via magic byte signatures.
 * Rejects files whose binary content doesn't match an allowed type,
 * catching spoofed MIME types and dangerous formats like SVG.
 */

interface ValidationResult {
  valid: boolean;
  detectedType: "image" | "video" | null;
  mimeType: string | null;
}

// Assinaturas de magic bytes para tipos de arquivo permitidos
const SIGNATURES: { bytes: number[]; offset: number; mimeType: string; type: "image" | "video" }[] = [
  // JPEG: FF D8 FF
  { bytes: [0xFF, 0xD8, 0xFF], offset: 0, mimeType: "image/jpeg", type: "image" },
  // PNG: 89 50 4E 47
  { bytes: [0x89, 0x50, 0x4E, 0x47], offset: 0, mimeType: "image/png", type: "image" },
  // GIF: 47 49 46 38
  { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0, mimeType: "image/gif", type: "image" },
  // WebM: 1A 45 DF A3
  { bytes: [0x1A, 0x45, 0xDF, 0xA3], offset: 0, mimeType: "video/webm", type: "video" },
];

function matchesSignature(buffer: Buffer, sig: { bytes: number[]; offset: number }): boolean {
  if (buffer.length < sig.offset + sig.bytes.length) return false;
  return sig.bytes.every((byte, i) => buffer[sig.offset + i] === byte);
}

function isWebP(buffer: Buffer): boolean {
  // WebP: começa com RIFF (52 49 46 46) e tem WEBP no offset 8
  if (buffer.length < 12) return false;
  return (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  );
}

function isMp4(buffer: Buffer): boolean {
  // MP4: "ftyp" at offset 4 (66 74 79 70)
  if (buffer.length < 8) return false;
  return (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  );
}

function isSvg(buffer: Buffer): boolean {
  // Verifica primeiros 256 bytes por marcadores SVG
  const head = buffer.subarray(0, Math.min(256, buffer.length)).toString("utf-8").toLowerCase();
  return head.includes("<svg") || head.includes("<?xml");
}

export function validateFileType(buffer: Buffer): ValidationResult {
  const invalid: ValidationResult = { valid: false, detectedType: null, mimeType: null };

  if (buffer.length === 0) return invalid;

  // Bloqueia SVG (vetor potencial de XSS)
  if (isSvg(buffer)) return invalid;

  // Verifica assinaturas padrão
  for (const sig of SIGNATURES) {
    if (matchesSignature(buffer, sig)) {
      return { valid: true, detectedType: sig.type, mimeType: sig.mimeType };
    }
  }

  // Verifica WebP (assinatura composta)
  if (isWebP(buffer)) {
    return { valid: true, detectedType: "image", mimeType: "image/webp" };
  }

  // Verifica MP4 (assinatura composta)
  if (isMp4(buffer)) {
    return { valid: true, detectedType: "video", mimeType: "video/mp4" };
  }

  return invalid;
}
