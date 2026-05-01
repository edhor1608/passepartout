import { resolve } from "node:path";
import type { MediaInspection, Orientation } from "../types/contracts";
import { readImageMetadata } from "./media_image_inspector";
import { readVideoMetadata } from "./media_video_inspector";

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
  const image = readImageMetadata(resolvedPath);
  const video =
    image || (!lower.endsWith(".mp4") && !lower.endsWith(".mov"))
      ? null
      : readVideoMetadata(resolvedPath);

  if (!image && !video) {
    throw new Error(`Unsupported media format for current analyze slice: ${filePath}`);
  }

  const width = image?.width ?? video?.width ?? 0;
  const height = image?.height ?? video?.height ?? 0;

  return {
    path: resolvedPath,
    width,
    height,
    aspect_ratio: formatAspect(width, height),
    orientation: detectOrientation(width, height),
    colorspace: image?.colorspace ?? "unknown",
    codec: video?.codec ?? null,
    fps: video?.fps ?? 0,
    duration_seconds: video?.durationSeconds ?? null,
    bitrate_kbps: video?.bitrateKbps ?? null,
    has_audio: video?.hasAudio ?? false,
    audio_codec: video?.audioCodec ?? null,
    audio_channels: video?.audioChannels ?? null,
    audio_channel_layout: video?.audioChannelLayout ?? null,
    audio_sample_rate_hz: video?.audioSampleRateHz ?? null,
    audio_sample_format: video?.audioSampleFormat ?? null,
    audio_bitrate_kbps: video?.audioBitrateKbps ?? null,
  };
}
