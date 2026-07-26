import { closeSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

type RenderReadyToUploadImageInput = {
  sourcePath: string;
  outputPath: string;
  borderPx: number;
};

type SourceDimensions = {
  width: number;
  height: number;
  color: SourceColorProperties | null;
};

type SourceColorProperties = {
  space: string;
  primaries: string;
  transfer: string;
  range: string;
};

type PrepareImageVariant = "landscape" | "portrait";

type SourceCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PrepareImageLayout = {
  variant: PrepareImageVariant;
  outputWidth: number;
  outputHeight: number;
  effectiveBorderPx: number;
  innerWidth: number;
  innerHeight: number;
  renderWidth: number;
  renderHeight: number;
  renderOffsetX: number;
  renderOffsetY: number;
  sourceCrop?: SourceCrop;
};

type PrepareImageLayoutInput = {
  sourceWidth: number;
  sourceHeight: number;
  borderPx: number;
};

type Target = {
  variant: PrepareImageVariant;
  maxWidth: number;
  maxHeight: number;
  ratioWidth: number;
  ratioHeight: number;
};

type MediaProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

const LANDSCAPE_TARGET = {
  maxHeight: 1440,
  maxWidth: 2160,
  ratioHeight: 2,
  ratioWidth: 3,
  variant: "landscape",
} as const satisfies Target;

const PORTRAIT_TARGET = {
  maxHeight: 1920,
  maxWidth: 1440,
  ratioHeight: 4,
  ratioWidth: 3,
  variant: "portrait",
} as const satisfies Target;

const require = createRequire(import.meta.url);
const FFMPEG_CMD = Bun.which("ffmpeg") ?? resolveBundledFfmpegPath() ?? "ffmpeg";
const FFPROBE_CMD = Bun.which("ffprobe") ?? resolveBundledFfprobePath() ?? "ffprobe";
const SUPPORTED_COLOR_SPACES = new Set([
  "bt709",
  "fcc",
  "bt470bg",
  "smpte170m",
  "smpte240m",
  "ycgco",
  "gbr",
  "bt2020nc",
  "bt2020ncl",
]);
const SUPPORTED_COLOR_PRIMARIES = new Set([
  "bt709",
  "bt470m",
  "bt470bg",
  "smpte170m",
  "smpte240m",
  "smpte428",
  "film",
  "smpte431",
  "smpte432",
  "bt2020",
  "jedec-p22",
]);
const SUPPORTED_COLOR_TRANSFERS = new Set([
  "bt709",
  "bt470m",
  "gamma22",
  "bt470bg",
  "gamma28",
  "smpte170m",
  "smpte240m",
  "linear",
  "srgb",
  "iec61966-2-1",
  "xvycc",
  "iec61966-2-4",
  "bt2020-10",
  "bt2020-12",
]);
const SUPPORTED_COLOR_RANGES = new Set(["pc", "jpeg", "tv", "mpeg"]);

export function renderReadyToUploadImage(input: RenderReadyToUploadImageInput): void {
  const sourcePath = resolve(input.sourcePath);
  const source = inspectSourceDimensions(sourcePath);
  const layout = computePrepareImageLayout({
    borderPx: input.borderPx,
    sourceHeight: source.height,
    sourceWidth: source.width,
  });

  const proc = runMediaProcess([
    FFMPEG_CMD,
    "-n",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    sourcePath,
    "-filter_complex",
    buildPrepareImageFilter(layout, source.color),
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
    input.outputPath,
  ]);

  if (proc.exitCode !== 0) {
    throw new Error(`ffmpeg export failed: ${proc.stderr.trim()}`);
  }

  markOutputAsSrgb(input.outputPath);
}

function resolveBundledFfmpegPath(): string | undefined {
  try {
    const path = require("ffmpeg-static") as unknown;
    return typeof path === "string" && path.length > 0 ? path : undefined;
  } catch {
    return undefined;
  }
}

function resolveBundledFfprobePath(): string | undefined {
  try {
    const ffprobeStatic = require("ffprobe-static") as { path?: unknown };
    return typeof ffprobeStatic.path === "string" && ffprobeStatic.path.length > 0
      ? ffprobeStatic.path
      : undefined;
  } catch {
    return undefined;
  }
}

function runMediaProcess(cmd: string[]): MediaProcessResult {
  const proc = Bun.spawnSync({
    cmd,
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

function inspectSourceDimensions(path: string): SourceDimensions {
  const proc = runMediaProcess([
    FFPROBE_CMD,
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
  const color = getSourceColorProperties(stream);

  if (rotation === 90 || rotation === 270 || isExifOrientationSwapped(readExifOrientation(path))) {
    return { color, height: width, width: height };
  }

  return { color, height, width };
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
    if (
      marker === 0xe1 &&
      bytes.subarray(payloadStart, payloadStart + 6).toString("ascii") === "Exif\0\0"
    ) {
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

function computePrepareImageLayout(input: PrepareImageLayoutInput): PrepareImageLayout {
  assertPositiveInteger(input.sourceWidth, "sourceWidth");
  assertPositiveInteger(input.sourceHeight, "sourceHeight");
  assertNonNegativeInteger(input.borderPx, "borderPx");

  const target = input.sourceWidth > input.sourceHeight ? LANDSCAPE_TARGET : PORTRAIT_TARGET;

  for (
    let outputWidth = target.maxWidth;
    outputWidth >= target.ratioWidth;
    outputWidth -= target.ratioWidth
  ) {
    const outputHeight = (outputWidth / target.ratioWidth) * target.ratioHeight;
    if (outputHeight > target.maxHeight) {
      continue;
    }

    const effectiveBorderPx = scaleBorder(input.borderPx, outputWidth / target.maxWidth);
    const innerWidth = outputWidth - 2 * effectiveBorderPx;
    const innerHeight = outputHeight - 2 * effectiveBorderPx;
    if (innerWidth <= 0 || innerHeight <= 0) {
      continue;
    }

    if (target.variant === "landscape") {
      if (innerWidth > input.sourceWidth || innerHeight > input.sourceHeight) {
        continue;
      }

      return createLandscapeLayout(input, {
        effectiveBorderPx,
        innerHeight,
        innerWidth,
        outputHeight,
        outputWidth,
      });
    }

    if (Math.min(innerWidth / input.sourceWidth, innerHeight / input.sourceHeight) > 1) {
      continue;
    }

    return createPortraitLayout(input, {
      effectiveBorderPx,
      innerHeight,
      innerWidth,
      outputHeight,
      outputWidth,
    });
  }

  throw new Error("Source image is too small for the requested border");
}

function createLandscapeLayout(
  input: PrepareImageLayoutInput,
  dimensions: Pick<
    PrepareImageLayout,
    "effectiveBorderPx" | "innerHeight" | "innerWidth" | "outputHeight" | "outputWidth"
  >,
): PrepareImageLayout {
  const crop = computeCenteredCoverCrop({
    frameHeight: dimensions.innerHeight,
    frameWidth: dimensions.innerWidth,
    sourceHeight: input.sourceHeight,
    sourceWidth: input.sourceWidth,
  });

  return {
    ...dimensions,
    renderHeight: dimensions.innerHeight,
    renderOffsetX: dimensions.effectiveBorderPx,
    renderOffsetY: dimensions.effectiveBorderPx,
    renderWidth: dimensions.innerWidth,
    sourceCrop: crop,
    variant: "landscape",
  };
}

function createPortraitLayout(
  input: PrepareImageLayoutInput,
  dimensions: Pick<
    PrepareImageLayout,
    "effectiveBorderPx" | "innerHeight" | "innerWidth" | "outputHeight" | "outputWidth"
  >,
): PrepareImageLayout {
  const renderScale = Math.min(
    1,
    dimensions.innerWidth / input.sourceWidth,
    dimensions.innerHeight / input.sourceHeight,
  );
  const renderWidth = Math.min(dimensions.innerWidth, Math.round(input.sourceWidth * renderScale));
  const renderHeight = Math.min(
    dimensions.innerHeight,
    Math.round(input.sourceHeight * renderScale),
  );

  return {
    ...dimensions,
    renderHeight,
    renderOffsetX: Math.round((dimensions.outputWidth - renderWidth) / 2),
    renderOffsetY: Math.round((dimensions.outputHeight - renderHeight) / 2),
    renderWidth,
    variant: "portrait",
  };
}

function computeCenteredCoverCrop(input: {
  sourceWidth: number;
  sourceHeight: number;
  frameWidth: number;
  frameHeight: number;
}): SourceCrop {
  const sourceRatio = input.sourceWidth / input.sourceHeight;
  const frameRatio = input.frameWidth / input.frameHeight;

  if (sourceRatio > frameRatio) {
    const width = Math.round(input.sourceHeight * frameRatio);
    return {
      height: input.sourceHeight,
      width,
      x: Math.round((input.sourceWidth - width) / 2),
      y: 0,
    };
  }

  const height = Math.round(input.sourceWidth / frameRatio);
  return {
    height,
    width: input.sourceWidth,
    x: 0,
    y: Math.round((input.sourceHeight - height) / 2),
  };
}

function scaleBorder(borderPx: number, scale: number): number {
  if (borderPx === 0) {
    return 0;
  }

  return Math.max(1, Math.round(borderPx * scale));
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

function buildPrepareImageFilter(
  layout: PrepareImageLayout,
  color: SourceColorProperties | null,
): string {
  const sourceFilters = [];
  if (color) {
    sourceFilters.push(
      [
        `colorspace=ispace=${color.space}`,
        `iprimaries=${color.primaries}`,
        `itrc=${color.transfer}`,
        `irange=${color.range}`,
        "space=bt470bg",
        "primaries=bt709",
        "trc=iec61966-2-1",
        "range=pc",
      ].join(":"),
    );
  }
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

function getSourceColorProperties(stream: Record<string, unknown>): SourceColorProperties | null {
  const space = getSupportedString(stream, "color_space", SUPPORTED_COLOR_SPACES);
  const primaries = getSupportedString(stream, "color_primaries", SUPPORTED_COLOR_PRIMARIES);
  const transfer = getSupportedString(stream, "color_transfer", SUPPORTED_COLOR_TRANSFERS);
  const range = getSupportedString(stream, "color_range", SUPPORTED_COLOR_RANGES);

  if (!space || !primaries || !transfer || !range) {
    return null;
  }

  return { primaries, range, space, transfer };
}

function getSupportedString(
  record: Record<string, unknown>,
  key: string,
  supportedValues: ReadonlySet<string>,
): string | null {
  const value = record[key];
  return typeof value === "string" && supportedValues.has(value) ? value : null;
}

function markOutputAsSrgb(path: string): void {
  const jpeg = readFileSync(path);
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
    throw new Error("Image engine did not produce a JPEG");
  }

  const exifPayload = Buffer.from([
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00, // Exif identifier
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08, // Big-endian TIFF header
    0x00,
    0x01, // IFD0 entry count
    0x87,
    0x69,
    0x00,
    0x04,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x1a, // Exif IFD
    0x00,
    0x00,
    0x00,
    0x00, // No next IFD
    0x00,
    0x01, // Exif IFD entry count
    0xa0,
    0x01,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x01,
    0x00,
    0x00, // sRGB
    0x00,
    0x00,
    0x00,
    0x00, // No next IFD
  ]);
  const segment = Buffer.alloc(4 + exifPayload.length);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment.writeUInt16BE(exifPayload.length + 2, 2);
  exifPayload.copy(segment, 4);

  writeFileSync(path, Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(2)]));
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
