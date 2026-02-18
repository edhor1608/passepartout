import { closeSync, openSync, readSync } from "node:fs";
import type { MediaInspection, Orientation } from "../types/contracts";

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

function readPpmSize(path: string): { width: number; height: number } {
  const fd = openSync(path, "r");
  const chunkSize = 16 * 1024;
  let bytes = new Uint8Array(0);
  let fileOffset = 0;
  let magic: string | null = null;
  let widthToken: string | null = null;
  let heightToken: string | null = null;
  try {
    while (true) {
      const chunk = Buffer.alloc(chunkSize);
      const bytesRead = readSync(fd, chunk, 0, chunk.length, fileOffset);
      if (bytesRead <= 0) {
        break;
      }
      fileOffset += bytesRead;
      const nextBytes = new Uint8Array(bytes.length + bytesRead);
      nextBytes.set(bytes, 0);
      nextBytes.set(chunk.subarray(0, bytesRead), bytes.length);
      bytes = nextBytes;

      const state = { index: 0 };
      magic = nextToken(bytes, state);
      widthToken = nextToken(bytes, state);
      heightToken = nextToken(bytes, state);
      if (magic && widthToken && heightToken) {
        break;
      }

      if (bytesRead < chunkSize) {
        break;
      }
    }
  } finally {
    closeSync(fd);
  }

  if (magic !== "P3" && magic !== "P6") {
    throw new Error(`Unsupported PPM magic in ${path}: ${magic ?? "<missing>"}`);
  }

  const width = Number.parseInt(widthToken ?? "", 10);
  const height = Number.parseInt(heightToken ?? "", 10);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid PPM dimensions in ${path}`);
  }

  return { width, height };
}

function detectOrientation(width: number, height: number): Orientation {
  if (width === height) {
    return "square";
  }
  return width > height ? "landscape" : "portrait";
}

function formatAspect(width: number, height: number): string {
  if (height <= 0) {
    throw new Error("Cannot compute aspect ratio with non-positive height");
  }
  return (width / height).toFixed(4);
}

export function inspectMedia(filePath: string): MediaInspection {
  const lower = filePath.toLowerCase();

  if (!lower.endsWith(".ppm")) {
    throw new Error(`Unsupported media format for Phase 1 analyze: ${filePath}`);
  }

  const { width, height } = readPpmSize(filePath);

  return {
    path: filePath,
    width,
    height,
    aspect_ratio: formatAspect(width, height),
    orientation: detectOrientation(width, height),
    colorspace: "sRGB",
    codec: null,
    fps: 0,
  };
}
