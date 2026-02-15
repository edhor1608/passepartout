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
      return { width, height };
    }

    i += segmentLen;
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

function readVideoMetadata(path: string): {
  width: number;
  height: number;
  codec: string | null;
  fps: number;
  durationSeconds: number | null;
  bitrateKbps: number | null;
  hasAudio: boolean;
  audioCodec: string | null;
} {
  const proc = Bun.spawnSync({
    cmd: [
      "ffprobe",
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate:format=duration,bit_rate",
      "-of",
      "json",
      path,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });

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
  if (!streams || streams.length === 0) {
    throw new Error(`ffprobe returned no video stream for ${path}`);
  }
  const videoStream =
    streams.find((item) => item.codec_type === "video") ??
    streams.find((item) => Number(item.width) > 0 && Number(item.height) > 0);
  if (!videoStream) {
    throw new Error(`ffprobe returned no video stream for ${path}`);
  }
  const audioStream = streams.find((item) => item.codec_type === "audio");
  const format = (parsed as { format?: Record<string, unknown> }).format;

  const width = Number(videoStream.width);
  const height = Number(videoStream.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid video dimensions in ${path}`);
  }

  const codecToken = videoStream.codec_name;
  const codec = typeof codecToken === "string" && codecToken.length > 0 ? codecToken : null;
  const avgFrameRate =
    typeof videoStream.avg_frame_rate === "string" ? videoStream.avg_frame_rate : undefined;
  const realFrameRate =
    typeof videoStream.r_frame_rate === "string" ? videoStream.r_frame_rate : undefined;
  const fps = parseFps(avgFrameRate) || parseFps(realFrameRate);
  const durationRaw = typeof format?.duration === "string" ? format.duration : undefined;
  const bitrateRaw = typeof format?.bit_rate === "string" ? format.bit_rate : undefined;
  const durationSeconds = parseDurationSeconds(durationRaw);
  const bitrateKbps = parseBitrateKbps(bitrateRaw);
  const audioCodecToken = audioStream?.codec_name;
  const audioCodec =
    typeof audioCodecToken === "string" && audioCodecToken.length > 0 ? audioCodecToken : null;
  const hasAudio = audioCodec !== null;

  return {
    width,
    height,
    codec,
    fps,
    durationSeconds,
    bitrateKbps,
    hasAudio,
    audioCodec,
  };
}

export function inspectMedia(filePath: string): MediaInspection {
  const resolvedPath = resolve(filePath);
  const lower = resolvedPath.toLowerCase();
  let width = 0;
  let height = 0;
  let colorspace = "unknown";
  let codec: string | null = null;
  let fps = 0;
  let durationSeconds: number | null = null;
  let bitrateKbps: number | null = null;
  let hasAudio = false;
  let audioCodec: string | null = null;

  if (lower.endsWith(".ppm")) {
    ({ width, height } = readPpmSize(resolvedPath));
    colorspace = "sRGB";
  } else if (lower.endsWith(".png")) {
    ({ width, height } = readPngSize(resolvedPath));
  } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    ({ width, height } = readJpegSize(resolvedPath));
  } else if (lower.endsWith(".mp4") || lower.endsWith(".mov")) {
    ({
      width,
      height,
      codec,
      fps,
      durationSeconds,
      bitrateKbps,
      hasAudio,
      audioCodec,
    } = readVideoMetadata(resolvedPath));
  } else {
    throw new Error(`Unsupported media format for current analyze slice: ${filePath}`);
  }

  return {
    path: resolvedPath,
    width,
    height,
    aspect_ratio: formatAspect(width, height),
    orientation: detectOrientation(width, height),
    colorspace,
    codec,
    fps,
    duration_seconds: durationSeconds,
    bitrate_kbps: bitrateKbps,
    has_audio: hasAudio,
    audio_codec: audioCodec,
  };
}
