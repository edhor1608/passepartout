import { resolve } from "node:path";
import { readFileSync } from "node:fs";
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

  return { width, height };
}

function detectOrientation(width: number, height: number): Orientation {
  if (width === height) {
    return "square";
  }
  return width > height ? "landscape" : "portrait";
}

function formatAspect(width: number, height: number): string {
  return (width / height).toFixed(4);
}

export function inspectMedia(filePath: string): MediaInspection {
  const resolvedPath = resolve(filePath);
  const lower = resolvedPath.toLowerCase();

  if (!lower.endsWith(".ppm")) {
    throw new Error(`Unsupported media format for Phase 1 analyze: ${filePath}`);
  }

  const { width, height } = readPpmSize(resolvedPath);

  return {
    path: resolvedPath,
    width,
    height,
    aspect_ratio: formatAspect(width, height),
    orientation: detectOrientation(width, height),
    colorspace: "sRGB",
    codec: null,
    fps: 0,
  };
}
