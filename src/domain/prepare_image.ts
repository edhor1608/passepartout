import { closeSync, openSync, readSync } from "node:fs";
import { resolve } from "node:path";
import { computePrepareImageLayout, type PrepareImageLayout } from "./prepare_image_layout";
import { runFfmpeg, runFfprobe } from "./media_process";
import { resolvePrepareImageOutputPath } from "./output_path";

export const DEFAULT_PREPARE_IMAGE_BORDER_PX = 57;

type PrepareImageInput = {
  inputPath: string;
  outputPath: string;
  borderPx?: number;
};

type PrepareImageOutput = {
  outputPath: string;
  layout: PrepareImageLayout;
};

type SourceDimensions = {
  width: number;
  height: number;
};

export function prepareImage(input: PrepareImageInput): PrepareImageOutput {
  const sourcePath = resolve(input.inputPath);
  const outputPath = resolvePrepareImageOutputPath(resolve(input.outputPath));
  const source = inspectSourceDimensions(sourcePath);
  const layout = computePrepareImageLayout({
    borderPx: input.borderPx ?? DEFAULT_PREPARE_IMAGE_BORDER_PX,
    sourceHeight: source.height,
    sourceWidth: source.width,
  });

  const proc = runFfmpeg([
    "-n",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    sourcePath,
    "-filter_complex",
    buildPrepareImageFilter(layout),
    "-map",
    "[out]",
    "-frames:v",
    "1",
    "-q:v",
    "1",
    "-pix_fmt",
    "yuvj420p",
    "-map_metadata",
    "-1",
    outputPath,
  ]);

  if (proc.exitCode !== 0) {
    throw new Error(`ffmpeg export failed: ${proc.stderr.trim()}`);
  }

  return { layout, outputPath };
}

function inspectSourceDimensions(path: string): SourceDimensions {
  const proc = runFfprobe([
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_streams",
    "-of",
    "json",
    path,
  ]);

  if (proc.exitCode !== 0) {
    throw new Error(`ffprobe failed: ${proc.stderr.trim()}`);
  }

  const payload = JSON.parse(proc.stdout) as unknown;
  const stream = getFirstStream(payload);
  const width = getNumber(stream, "width");
  const height = getNumber(stream, "height");
  const rotation = getRotation(stream);

  if (rotation === 90 || rotation === 270 || isExifOrientationSwapped(readExifOrientation(path))) {
    return { height: width, width: height };
  }

  return { height, width };
}

function readExifOrientation(path: string): number | null {
  const lower = path.toLowerCase();
  if (!lower.endsWith(".jpg") && !lower.endsWith(".jpeg")) {
    return null;
  }

  const bytes = readFileHeader(path);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }

    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) {
      return null;
    }
    const payloadStart = offset + 4;
    const payloadEnd = offset + 2 + length;
    if (payloadEnd > bytes.length) {
      return null;
    }
    if (marker === 0xe1 && bytes.subarray(payloadStart, payloadStart + 6).toString("ascii") === "Exif\0\0") {
      return readTiffOrientation(bytes.subarray(payloadStart + 6, payloadEnd));
    }

    offset = payloadEnd;
  }

  return null;
}

function readFileHeader(path: string): Buffer {
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(64 * 1024);
    const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    closeSync(fd);
  }
}

function readTiffOrientation(bytes: Buffer): number | null {
  if (bytes.length < 8) {
    return null;
  }

  const littleEndian = bytes.subarray(0, 2).toString("ascii") === "II";
  const bigEndian = bytes.subarray(0, 2).toString("ascii") === "MM";
  if (!littleEndian && !bigEndian) {
    return null;
  }

  const readUInt16 = littleEndian ? Buffer.prototype.readUInt16LE : Buffer.prototype.readUInt16BE;
  const readUInt32 = littleEndian ? Buffer.prototype.readUInt32LE : Buffer.prototype.readUInt32BE;
  if (readUInt16.call(bytes, 2) !== 42) {
    return null;
  }
  const ifdOffset = readUInt32.call(bytes, 4);
  if (ifdOffset + 2 > bytes.length) {
    return null;
  }
  const entryCount = readUInt16.call(bytes, ifdOffset);
  if (ifdOffset + 2 + entryCount * 12 > bytes.length) {
    return null;
  }

  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (readUInt16.call(bytes, entryOffset) !== 0x0112) {
      continue;
    }

    const type = readUInt16.call(bytes, entryOffset + 2);
    const count = readUInt32.call(bytes, entryOffset + 4);
    if (type !== 3 || count !== 1) {
      return null;
    }

    return readUInt16.call(bytes, entryOffset + 8);
  }

  return null;
}

function isExifOrientationSwapped(orientation: number | null): boolean {
  return orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8;
}

function buildPrepareImageFilter(layout: PrepareImageLayout): string {
  const sourceFilters = [];
  if (layout.sourceCrop) {
    sourceFilters.push(
      `crop=${layout.sourceCrop.width}:${layout.sourceCrop.height}:${layout.sourceCrop.x}:${layout.sourceCrop.y}`,
    );
  }
  sourceFilters.push(`scale=${layout.renderWidth}:${layout.renderHeight}`, "setsar=1");

  return [
    `[0:v]${sourceFilters.join(",")}[fg]`,
    `color=c=white:s=${layout.outputWidth}x${layout.outputHeight}[bg]`,
    `[bg][fg]overlay=${layout.renderOffsetX}:${layout.renderOffsetY}:format=auto,format=yuvj420p[out]`,
  ].join(";");
}

function getFirstStream(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || !Array.isArray(value.streams) || !isRecord(value.streams[0])) {
    throw new Error("ffprobe did not return an image stream");
  }

  return value.streams[0];
}

function getNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`ffprobe returned invalid ${key}`);
  }

  return value;
}

function getRotation(stream: Record<string, unknown>): number {
  const tags = stream.tags;
  if (isRecord(tags) && typeof tags.rotate === "string") {
    return normalizeRotation(Number.parseInt(tags.rotate, 10));
  }

  const sideData = stream.side_data_list;
  if (Array.isArray(sideData)) {
    for (const entry of sideData) {
      if (isRecord(entry) && typeof entry.rotation === "number") {
        return normalizeRotation(entry.rotation);
      }
    }
  }

  return 0;
}

function normalizeRotation(rotation: number): number {
  if (!Number.isFinite(rotation)) {
    return 0;
  }

  return ((rotation % 360) + 360) % 360;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
