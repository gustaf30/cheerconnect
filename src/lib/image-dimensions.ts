function readUInt16BE(buffer: Buffer, offset: number): number | null {
  if (offset < 0 || offset + 2 > buffer.length) return null;
  return buffer.readUInt16BE(offset);
}

function readUInt16LE(buffer: Buffer, offset: number): number | null {
  if (offset < 0 || offset + 2 > buffer.length) return null;
  return buffer.readUInt16LE(offset);
}

function readUInt32BE(buffer: Buffer, offset: number): number | null {
  if (offset < 0 || offset + 4 > buffer.length) return null;
  return buffer.readUInt32BE(offset);
}

function pngDimensions(buffer: Buffer) {
  if (buffer.length < 24) return null;
  const width = readUInt32BE(buffer, 16);
  const height = readUInt32BE(buffer, 20);
  return width && height ? { width, height } : null;
}

function gifDimensions(buffer: Buffer) {
  if (buffer.length < 10) return null;
  const width = readUInt16LE(buffer, 6);
  const height = readUInt16LE(buffer, 8);
  return width && height ? { width, height } : null;
}

function jpegDimensions(buffer: Buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const length = readUInt16BE(buffer, offset);
    if (!length || length < 2) return null;

    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xc3 ||
      marker >= 0xc5 && marker <= 0xc7 ||
      marker >= 0xc9 && marker <= 0xcb ||
      marker >= 0xcd && marker <= 0xcf;

    if (isStartOfFrame) {
      const height = readUInt16BE(buffer, offset + 3);
      const width = readUInt16BE(buffer, offset + 5);
      return width && height ? { width, height } : null;
    }
    offset += length;
  }
  return null;
}

function webpDimensions(buffer: Buffer) {
  if (buffer.length < 30) return null;
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }
  if (chunk === "VP8 ") {
    const width = readUInt16LE(buffer, 26);
    const height = readUInt16LE(buffer, 28);
    return width && height ? { width, height } : null;
  }
  if (chunk === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  return null;
}

export function getImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length >= 8 && buffer.toString("ascii", 12, 16) === "RIFF") {
    return webpDimensions(buffer);
  }
  if (buffer.length >= 24 && buffer.toString("ascii", 12, 16) === "WEBP") {
    return webpDimensions(buffer);
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return pngDimensions(buffer);
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return gifDimensions(buffer);
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return jpegDimensions(buffer);
  }
  return null;
}
