import { closeSync, openSync, readSync } from "node:fs";
import { resolve } from "node:path";
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

function readPngSize(path: string): { width: number; height: number } {
  const fd = openSync(path, "r");
  const header = Buffer.alloc(24);
  let bytesRead = 0;
  try {
    bytesRead = readSync(fd, header, 0, header.length, 0);
  } finally {
    closeSync(fd);
  }

  if (bytesRead < header.length) {
    throw new Error(`Invalid PNG signature in ${path}`);
  }

  const bytes = new Uint8Array(header);
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

  return { width, height };
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

function readJpegSize(path: string): { width: number; height: number } {
  const fd = openSync(path, "r");
  let position = 0;
  try {
    const soi = Buffer.alloc(2);
    const soiRead = readSync(fd, soi, 0, soi.length, position);
    position += soiRead;
    if (soiRead !== 2 || soi[0] !== 0xff || soi[1] !== 0xd8) {
      throw new Error(`Invalid JPEG SOI in ${path}`);
    }

    while (true) {
      const markerBuf = Buffer.alloc(1);
      let markerRead = 0;
      do {
        markerRead = readSync(fd, markerBuf, 0, markerBuf.length, position);
        if (markerRead !== 1) {
          throw new Error(`JPEG SOF segment not found in ${path}`);
        }
        position += 1;
      } while (markerBuf[0] === 0xff);

      const marker = markerBuf[0]!;
      if (marker === 0xd8 || marker === 0xd9) {
        continue;
      }
      if (marker === 0xda) {
        break;
      }

      const segmentLenBytes = Buffer.alloc(2);
      const segmentLenRead = readSync(fd, segmentLenBytes, 0, segmentLenBytes.length, position);
      if (segmentLenRead !== 2) {
        throw new Error(`JPEG SOF segment not found in ${path}`);
      }
      position += 2;
      const segmentLen = readBe16(new Uint8Array(segmentLenBytes), 0);
      if (segmentLen < 2) {
        throw new Error(`Invalid JPEG segment length in ${path}`);
      }

      if (isSofMarker(marker)) {
        if (segmentLen < 7) {
          throw new Error(`Invalid JPEG segment length in ${path}`);
        }
        const sofHeader = Buffer.alloc(5);
        const sofRead = readSync(fd, sofHeader, 0, sofHeader.length, position);
        if (sofRead !== 5) {
          throw new Error(`JPEG SOF segment not found in ${path}`);
        }
        const sofBytes = new Uint8Array(sofHeader);
        const height = readBe16(sofBytes, 1);
        const width = readBe16(sofBytes, 3);
        if (width <= 0 || height <= 0) {
          throw new Error(`Invalid JPEG dimensions in ${path}`);
        }
        return { width, height };
      }

      position += segmentLen - 2;
    }
  } finally {
    closeSync(fd);
  }

  throw new Error(`JPEG SOF segment not found in ${path}`);
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

function parseFps(raw: string | undefined): number {
  if (!raw || raw === "0/0") {
    return 0;
  }

  const [numToken, denToken] = raw.split("/");
  const numerator = Number.parseFloat(numToken ?? "");
  const denominator = Number.parseFloat(denToken ?? "");

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }

  const value = numerator / denominator;
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 0.001) {
    return rounded;
  }
  return Number.parseFloat(value.toFixed(3));
}

function parseDurationSeconds(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Number.parseFloat(value.toFixed(3));
}

function parseBitrateKbps(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value / 1000);
}

function parseRotationValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readRotation(stream: Record<string, unknown>): number {
  let rotation: number | null = null;

  const tags = stream.tags;
  if (tags && typeof tags === "object") {
    rotation = parseRotationValue((tags as Record<string, unknown>).rotate);
  }

  const sideData = stream.side_data_list;
  if (Array.isArray(sideData)) {
    for (const entry of sideData) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const candidate = parseRotationValue((entry as Record<string, unknown>).rotation);
      if (candidate !== null) {
        rotation = candidate;
        break;
      }
    }
  }

  if (rotation === null) {
    return 0;
  }

  const normalized = ((Math.round(rotation) % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  return 0;
}

function readVideoMetadata(path: string): {
  width: number;
  height: number;
  codec: string | null;
  fps: number;
  durationSeconds: number | null;
  bitrateKbps: number | null;
} {
  let proc: ReturnType<typeof Bun.spawnSync>;
  try {
    proc = Bun.spawnSync({
      cmd: [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,codec_name,avg_frame_rate,r_frame_rate:stream_tags=rotate:stream_side_data=rotation:format=duration,bit_rate",
        "-of",
        "json",
        path,
      ],
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch {
    throw new Error("ffprobe is required for video analyze but was not found in PATH");
  }

  if (proc.exitCode !== 0) {
    throw new Error(`ffprobe failed for ${path}: ${proc.stderr.toString().trim()}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(proc.stdout.toString());
  } catch {
    throw new Error(`ffprobe returned invalid JSON for ${path}`);
  }

  const streams = (parsed as { streams?: Array<Record<string, unknown>> }).streams;
  const stream = streams?.[0];
  if (!stream) {
    throw new Error(`ffprobe returned no video stream for ${path}`);
  }
  const format = (parsed as { format?: Record<string, unknown> }).format;

  const width = Number(stream.width);
  const height = Number(stream.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid video dimensions in ${path}`);
  }
  const rotation = readRotation(stream);
  const isQuarterTurn = rotation === 90 || rotation === 270;
  const displayWidth = isQuarterTurn ? height : width;
  const displayHeight = isQuarterTurn ? width : height;

  const codecToken = stream.codec_name;
  const codec = typeof codecToken === "string" && codecToken.length > 0 ? codecToken : null;
  const avgFrameRate =
    typeof stream.avg_frame_rate === "string" ? stream.avg_frame_rate : undefined;
  const realFrameRate =
    typeof stream.r_frame_rate === "string" ? stream.r_frame_rate : undefined;
  const fps = parseFps(avgFrameRate) || parseFps(realFrameRate);
  const durationRaw = typeof format?.duration === "string" ? format.duration : undefined;
  const bitrateRaw = typeof format?.bit_rate === "string" ? format.bit_rate : undefined;
  const durationSeconds = parseDurationSeconds(durationRaw);
  const bitrateKbps = parseBitrateKbps(bitrateRaw);

  return { width: displayWidth, height: displayHeight, codec, fps, durationSeconds, bitrateKbps };
}

export function inspectMedia(filePath: string): MediaInspection {
  const resolvedPath = resolve(filePath);
  const lower = filePath.toLowerCase();
  let width = 0;
  let height = 0;
  let colorspace = "unknown";
  let codec: string | null = null;
  let fps = 0;
  let durationSeconds: number | null = null;
  let bitrateKbps: number | null = null;

  if (lower.endsWith(".ppm")) {
    ({ width, height } = readPpmSize(resolvedPath));
    colorspace = "sRGB";
  } else if (lower.endsWith(".png")) {
    ({ width, height } = readPngSize(resolvedPath));
  } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    ({ width, height } = readJpegSize(resolvedPath));
  } else if (lower.endsWith(".mp4") || lower.endsWith(".mov")) {
    ({ width, height, codec, fps, durationSeconds, bitrateKbps } = readVideoMetadata(resolvedPath));
  } else {
    throw new Error(`Unsupported media format for current analyze slice: ${filePath}`);
  }

  return {
    path: filePath,
    width,
    height,
    aspect_ratio: formatAspect(width, height),
    orientation: detectOrientation(width, height),
    colorspace,
    codec,
    fps,
    duration_seconds: durationSeconds,
    bitrate_kbps: bitrateKbps,
  };
}
