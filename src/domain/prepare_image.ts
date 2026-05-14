import { resolve } from "node:path";
import { computePrepareImageLayout, type PrepareImageLayout } from "./prepare_image_layout";
import { runFfmpeg, runFfprobe } from "./media_process";
import { resolvePrepareImageOutputPath } from "./output_path";

export const DEFAULT_PREPARE_IMAGE_BORDER_PX = 165;

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
    "-y",
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
    "-show_entries",
    "stream=width,height:stream_tags=rotate:stream_side_data=rotation",
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

  if (rotation === 90 || rotation === 270) {
    return { height: width, width: height };
  }

  return { height, width };
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
