import { readFileSync, writeFileSync } from "node:fs";
import type { Margins } from "../../src/types/contracts";

export type RgbImage = {
  width: number;
  height: number;
  pixels: Uint8Array;
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

function parseHeader(bytes: Uint8Array): {
  magic: "P3" | "P6";
  width: number;
  height: number;
  max: number;
  dataOffset: number;
} {
  const state = { index: 0 };
  const magic = nextToken(bytes, state);
  const widthToken = nextToken(bytes, state);
  const heightToken = nextToken(bytes, state);
  const maxToken = nextToken(bytes, state);

  if (magic !== "P3" && magic !== "P6") {
    throw new Error(`Unsupported PPM magic: ${magic ?? "<missing>"}`);
  }

  const width = Number.parseInt(widthToken ?? "", 10);
  const height = Number.parseInt(heightToken ?? "", 10);
  const max = Number.parseInt(maxToken ?? "", 10);

  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(max)) {
    throw new Error("Invalid PPM header");
  }

  while (state.index < bytes.length) {
    const c = bytes[state.index];
    if (c === 9 || c === 10 || c === 13 || c === 32) {
      state.index += 1;
      continue;
    }
    break;
  }

  return { magic, width, height, max, dataOffset: state.index };
}

export function readP3Image(path: string): RgbImage {
  const text = readFileSync(path, "utf8");
  const cleaned = text.replace(/#[^\n]*/g, "");
  const tokens = cleaned
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens[0] !== "P3") {
    throw new Error(`Not a P3 image: ${path}`);
  }

  const width = Number.parseInt(tokens[1] ?? "", 10);
  const height = Number.parseInt(tokens[2] ?? "", 10);
  const max = Number.parseInt(tokens[3] ?? "", 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || max !== 255) {
    throw new Error(`Invalid P3 image header: ${path}`);
  }

  const pixelTokens = tokens.slice(4);
  const expected = width * height * 3;
  if (pixelTokens.length !== expected) {
    throw new Error(`Invalid P3 pixel count for ${path}. expected ${expected}, got ${pixelTokens.length}`);
  }

  const pixels = new Uint8Array(expected);
  for (let i = 0; i < expected; i += 1) {
    const value = Number.parseInt(pixelTokens[i] ?? "", 10);
    if (!Number.isFinite(value) || value < 0 || value > 255) {
      throw new Error(`Invalid P3 channel value at ${i} in ${path}`);
    }
    pixels[i] = value;
  }

  return { width, height, pixels };
}

export function readP6Image(path: string): RgbImage {
  const bytes = new Uint8Array(readFileSync(path));
  const header = parseHeader(bytes);
  if (header.magic !== "P6") {
    throw new Error(`Not a P6 image: ${path}`);
  }
  if (header.max !== 255) {
    throw new Error(`Unsupported max value in ${path}: ${header.max}`);
  }

  const expectedSize = header.width * header.height * 3;
  const payload = bytes.subarray(header.dataOffset);
  if (payload.length !== expectedSize) {
    throw new Error(
      `Invalid P6 payload size for ${path}. expected ${expectedSize}, got ${payload.length}`,
    );
  }

  return {
    width: header.width,
    height: header.height,
    pixels: new Uint8Array(payload),
  };
}

export function writeP6Image(path: string, image: RgbImage): void {
  const header = Buffer.from(`P6\n${image.width} ${image.height}\n255\n`, "ascii");
  const out = new Uint8Array(header.length + image.pixels.length);
  out.set(header, 0);
  out.set(image.pixels, header.length);
  writeFileSync(path, out);
}

export function renderContainCanvas(params: {
  source: RgbImage;
  canvasWidth: number;
  canvasHeight: number;
  margins: Margins;
  background?: [number, number, number];
}): RgbImage {
  const { source, canvasWidth, canvasHeight, margins, background = [255, 255, 255] } = params;
  const innerWidth = canvasWidth - (margins.left + margins.right);
  const innerHeight = canvasHeight - (margins.top + margins.bottom);
  if (innerWidth <= 0 || innerHeight <= 0) {
    throw new Error("Invalid margins: non-positive inner box");
  }

  const scale = Math.min(innerWidth / source.width, innerHeight / source.height);
  const renderWidth = Math.max(1, Math.floor(source.width * scale));
  const renderHeight = Math.max(1, Math.floor(source.height * scale));

  const offsetX = margins.left + Math.floor((innerWidth - renderWidth) / 2);
  const offsetY = margins.top + Math.floor((innerHeight - renderHeight) / 2);

  const pixels = new Uint8Array(canvasWidth * canvasHeight * 3);
  for (let y = 0; y < canvasHeight; y += 1) {
    for (let x = 0; x < canvasWidth; x += 1) {
      const i = (y * canvasWidth + x) * 3;
      pixels[i] = background[0];
      pixels[i + 1] = background[1];
      pixels[i + 2] = background[2];
    }
  }

  for (let y = 0; y < renderHeight; y += 1) {
    const sy = Math.min(source.height - 1, Math.floor((y * source.height) / renderHeight));
    for (let x = 0; x < renderWidth; x += 1) {
      const sx = Math.min(source.width - 1, Math.floor((x * source.width) / renderWidth));

      const dstX = offsetX + x;
      const dstY = offsetY + y;
      if (dstX < 0 || dstX >= canvasWidth || dstY < 0 || dstY >= canvasHeight) {
        continue;
      }

      const srcI = (sy * source.width + sx) * 3;
      const dstI = (dstY * canvasWidth + dstX) * 3;
      pixels[dstI] = source.pixels[srcI]!;
      pixels[dstI + 1] = source.pixels[srcI + 1]!;
      pixels[dstI + 2] = source.pixels[srcI + 2]!;
    }
  }

  return { width: canvasWidth, height: canvasHeight, pixels };
}

export function diffRgb(a: RgbImage, b: RgbImage): {
  mismatchPixels: number;
  maxChannelDelta: number;
  meanChannelDelta: number;
} {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`Dimension mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }

  let mismatchPixels = 0;
  let maxChannelDelta = 0;
  let sum = 0;

  for (let i = 0; i < a.pixels.length; i += 3) {
    const dr = Math.abs(a.pixels[i]! - b.pixels[i]!);
    const dg = Math.abs(a.pixels[i + 1]! - b.pixels[i + 1]!);
    const db = Math.abs(a.pixels[i + 2]! - b.pixels[i + 2]!);
    const pixelDelta = Math.max(dr, dg, db);
    if (pixelDelta > 0) {
      mismatchPixels += 1;
    }
    if (pixelDelta > maxChannelDelta) {
      maxChannelDelta = pixelDelta;
    }
    sum += dr + dg + db;
  }

  return {
    mismatchPixels,
    maxChannelDelta,
    meanChannelDelta: sum / (a.pixels.length / 3),
  };
}
