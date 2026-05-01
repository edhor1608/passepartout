import { readFileSync } from "node:fs";

type ImageSize = {
  width: number;
  height: number;
  colorspace: string;
};

function nextToken(source: Uint8Array, state: { index: number }): string | null {
  while (state.index < source.length) {
    const c = source[state.index];
    if (c === 35) {
      while (state.index < source.length && source[state.index] !== 10) {
        state.index += 1;
      }
      continue;
    }
    if (c === 9 || c === 10 || c === 13 || c === 32) {
      state.index += 1;
      continue;
    }
    break;
  }

  if (state.index >= source.length) {
    return null;
  }

  const start = state.index;
  while (state.index < source.length) {
    const c = source[state.index];
    if (c === 9 || c === 10 || c === 13 || c === 32 || c === 35) {
      break;
    }
    state.index += 1;
  }

  return Buffer.from(source.subarray(start, state.index)).toString("ascii");
}

function readPpmSize(path: string): ImageSize {
  const bytes = new Uint8Array(readFileSync(path));
  const state = { index: 0 };
  const magic = nextToken(bytes, state);
  const widthToken = nextToken(bytes, state);
  const heightToken = nextToken(bytes, state);

  if (magic !== "P3" && magic !== "P6") {
    throw new Error(`Unsupported PPM magic in ${path}: ${magic ?? "<missing>"}`);
  }

  const width = Number.parseInt(widthToken ?? "", 10);
  const height = Number.parseInt(heightToken ?? "", 10);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Invalid PPM dimensions in ${path}`);
  }

  return { width, height, colorspace: "sRGB" };
}

function readBe16(bytes: Uint8Array, offset: number): number {
  const a = bytes[offset];
  const b = bytes[offset + 1];
  if (a === undefined || b === undefined) {
    throw new Error("Unexpected EOF while reading 16-bit value");
  }
  return (a << 8) | b;
}

function readBe32(bytes: Uint8Array, offset: number): number {
  const a = bytes[offset];
  const b = bytes[offset + 1];
  const c = bytes[offset + 2];
  const d = bytes[offset + 3];
  if (a === undefined || b === undefined || c === undefined || d === undefined) {
    throw new Error("Unexpected EOF while reading 32-bit value");
  }
  return (a * 2 ** 24) + (b << 16) + (c << 8) + d;
}

function readPngSize(path: string): ImageSize {
  const bytes = new Uint8Array(readFileSync(path));
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < pngSig.length; i += 1) {
    if (bytes[i] !== pngSig[i]) {
      throw new Error(`Invalid PNG signature in ${path}`);
    }
  }

  const ihdrType = Buffer.from(bytes.subarray(12, 16)).toString("ascii");
  if (ihdrType !== "IHDR") {
    throw new Error(`Invalid PNG IHDR in ${path}`);
  }

  const width = readBe32(bytes, 16);
  const height = readBe32(bytes, 20);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid PNG dimensions in ${path}`);
  }

  return { width, height, colorspace: "unknown" };
}

function isSofMarker(marker: number): boolean {
  return (
    marker === 0xc0 ||
    marker === 0xc1 ||
    marker === 0xc2 ||
    marker === 0xc3 ||
    marker === 0xc5 ||
    marker === 0xc6 ||
    marker === 0xc7 ||
    marker === 0xc9 ||
    marker === 0xca ||
    marker === 0xcb ||
    marker === 0xcd ||
    marker === 0xce ||
    marker === 0xcf
  );
}

function readJpegSize(path: string): ImageSize {
  const bytes = new Uint8Array(readFileSync(path));
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error(`Invalid JPEG SOI in ${path}`);
  }

  let i = 2;
  while (i < bytes.length) {
    while (bytes[i] === 0xff) {
      i += 1;
    }
    const marker = bytes[i];
    if (marker === undefined) {
      break;
    }
    i += 1;

    if (marker === 0xd8 || marker === 0xd9) {
      continue;
    }
    if (marker === 0xda) {
      break;
    }

    const segmentLen = readBe16(bytes, i);
    if (segmentLen < 2) {
      throw new Error(`Invalid JPEG segment length in ${path}`);
    }

    if (isSofMarker(marker)) {
      const height = readBe16(bytes, i + 3);
      const width = readBe16(bytes, i + 5);
      if (width <= 0 || height <= 0) {
        throw new Error(`Invalid JPEG dimensions in ${path}`);
      }
      return { width, height, colorspace: "unknown" };
    }

    i += segmentLen;
  }

  throw new Error(`JPEG SOF segment not found in ${path}`);
}

export function readImageMetadata(path: string): ImageSize | null {
  const lower = path.toLowerCase();
  if (lower.endsWith(".ppm")) {
    return readPpmSize(path);
  }
  if (lower.endsWith(".png")) {
    return readPngSize(path);
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return readJpegSize(path);
  }
  return null;
}
