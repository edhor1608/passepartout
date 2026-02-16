import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ExportVideoInput, ExportVideoOutput } from "../types/contracts";
import { loadExportProfiles, selectVideoExportProfile } from "./export_profiles";
import { inspectMedia } from "./media_inspector";
import { recommend } from "./recommend";
import { parseResolution } from "./rules";

const EXPORT_PROFILES = loadExportProfiles();

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

  const media = inspectMedia(input.file);
  const exportProfile = selectVideoExportProfile(EXPORT_PROFILES, {
    mode: input.mode,
    surface: input.surface,
    orientation: media.orientation,
  });
  const crf = input.crf ?? exportProfile.crf_default;

  const recommendation = recommend({
    mode: input.mode,
    surface: input.surface,
    orientation: media.orientation,
    workflow,
    whiteCanvas: input.whiteCanvas,
    canvasProfile: input.canvasProfile,
    canvasStyle: input.canvasStyle,
    sourceRatio: media.width / media.height,
  });

  const { width, height } = parseResolution(recommendation.target_resolution);
  const filter = buildFilter({
    targetWidth: width,
    targetHeight: height,
    whiteCanvasEnabled: recommendation.white_canvas.enabled,
    margins: recommendation.white_canvas.margins,
  });

  const inputPath = resolve(input.file);
  const outputPath = resolve(input.out);
  mkdirSync(dirname(outputPath), { recursive: true });

  const fps = media.fps > 0 ? media.fps : 30;
  const proc = Bun.spawnSync({
    cmd: [
      "ffmpeg",
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      inputPath,
      "-vf",
      filter,
      "-r",
      String(fps),
      "-c:v",
      exportProfile.ffmpeg_video_codec,
      "-crf",
      String(crf),
      "-pix_fmt",
      exportProfile.pix_fmt,
      "-movflags",
      exportProfile.movflags,
      ...(exportProfile.strip_audio ? ["-an"] : []),
      outputPath,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    throw new Error(`ffmpeg video export failed: ${proc.stderr.toString().trim()}`);
  }
  const outputMeta = inspectMedia(outputPath);

  return {
    input_path: inputPath,
    output_path: outputPath,
    export_profile_id: exportProfile.profile_id,
    crf_used: crf,
    selected_profile: recommendation.selected_profile,
    target_resolution: recommendation.target_resolution,
    white_canvas_enabled: recommendation.white_canvas.enabled,
    ffmpeg_filter: filter,
    video_codec: exportProfile.output_codec,
    fps,
    output_width: outputMeta.width,
    output_height: outputMeta.height,
    output_codec: outputMeta.codec,
    output_fps: outputMeta.fps,
    output_has_audio: outputMeta.has_audio,
    output_audio_codec: outputMeta.audio_codec,
  };
}
