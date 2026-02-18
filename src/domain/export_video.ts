import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ExportVideoInput, ExportVideoOutput } from "../types/contracts";
import { inspectMedia } from "./media_inspector";
import { recommend } from "./recommend";
import { parseResolution } from "./rules";

function buildFilter(params: {
  targetWidth: number;
  targetHeight: number;
  whiteCanvasEnabled: boolean;
  margins: { left: number; top: number; right: number; bottom: number } | null;
}): string {
  const { targetWidth, targetHeight, whiteCanvasEnabled, margins } = params;

  if (whiteCanvasEnabled && margins) {
    const innerWidth = targetWidth - (margins.left + margins.right);
    const innerHeight = targetHeight - (margins.top + margins.bottom);

    if (innerWidth <= 0 || innerHeight <= 0) {
      throw new Error("Invalid white-canvas margins: non-positive inner frame");
    }

    return [
      `scale=${innerWidth}:${innerHeight}:force_original_aspect_ratio=decrease`,
      `pad=${innerWidth}:${innerHeight}:(ow-iw)/2:(oh-ih)/2:white`,
      `pad=${targetWidth}:${targetHeight}:${margins.left}:${margins.top}:white`,
    ].join(",");
  }

  return [
    `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase`,
    `crop=${targetWidth}:${targetHeight}`,
  ].join(",");
}

export function exportVideo(input: ExportVideoInput): ExportVideoOutput {
  const workflow = input.workflow ?? "unknown";
  const crf = input.crf ?? 23;

  const media = inspectMedia(input.file);
  const recommendation = recommend({
    mode: input.mode,
    surface: input.surface,
    orientation: media.orientation,
    workflow,
    whiteCanvas: input.whiteCanvas,
    canvasProfile: input.canvasProfile,
    sourceRatio: media.width / media.height,
  });

  const { width, height } = parseResolution(recommendation.target_resolution);
  const filter = buildFilter({
    targetWidth: width,
    targetHeight: height,
    whiteCanvasEnabled: recommendation.white_canvas.enabled,
    margins: recommendation.white_canvas.margins,
  });

  const resolvedInputPath = resolve(input.file);
  const resolvedOutputPath = resolve(input.out);
  mkdirSync(dirname(resolvedOutputPath), { recursive: true });

  const fps = media.fps > 0 ? media.fps : 30;
  const proc = Bun.spawnSync({
    cmd: [
      "ffmpeg",
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      resolvedInputPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-vf",
      filter,
      "-r",
      String(fps),
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-crf",
      String(crf),
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      resolvedOutputPath,
    ],
    stdout: "pipe",
    stderr: "pipe",
    timeout: 60_000,
  });

  if (proc.exitCode !== 0) {
    throw new Error(
      `ffmpeg video export failed (input: ${resolvedInputPath}, filter: ${filter}): ${proc.stderr.toString().trim()}`,
    );
  }

  return {
    input_path: input.file,
    output_path: input.out,
    selected_profile: recommendation.selected_profile,
    target_resolution: recommendation.target_resolution,
    white_canvas_enabled: recommendation.white_canvas.enabled,
    ffmpeg_filter: filter,
    video_codec: "h264",
    fps,
  };
}
