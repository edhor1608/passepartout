import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Mode, Orientation, Surface } from "../types/contracts";

type ExportImageProfile = {
  profile_id: string;
  quality_default: number;
};

type ExportVideoProfile = {
  profile_id: string;
  ffmpeg_video_codec: string;
  output_codec: string;
  pix_fmt: string;
  movflags: string;
  crf_default: number;
  strip_audio: boolean;
};

type ExportImageModeRules = {
  feed: Record<Orientation, ExportImageProfile>;
  story: ExportImageProfile;
  reel: ExportImageProfile;
};

type ExportVideoModeRules = {
  feed: Record<Orientation, ExportVideoProfile>;
  story: ExportVideoProfile;
  reel: ExportVideoProfile;
};

export type ExportProfiles = {
  version: string;
  image: Record<Mode, ExportImageModeRules>;
  video: Record<Mode, ExportVideoModeRules>;
};

export const DEFAULT_EXPORT_PROFILES_PATH = fileURLToPath(new URL("../../config/export_profiles.v1.json", import.meta.url));

const MODES = ["reliable", "experimental"] as const satisfies readonly Mode[];
const ORIENTATIONS = ["portrait", "square", "landscape"] as const satisfies readonly Orientation[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(path: string, message: string): never {
  throw new Error(`Invalid export profiles at ${path}: ${message}`);
}

function readRecord(value: unknown, path: string, key: string): Record<string, unknown> {
  if (!isRecord(value)) {
    fail(path, `${key} must be an object`);
  }
  return value;
}

function readString(value: unknown, path: string, key: string): void {
  if (typeof value !== "string" || value.length === 0) {
    fail(path, `${key} must be a non-empty string`);
  }
}

function readIntegerInRange(value: unknown, path: string, key: string, min: number, max: number): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    fail(path, `${key} must be an integer from ${min} to ${max}`);
  }
}

function validateImageProfile(value: unknown, path: string, key: string): void {
  const profile = readRecord(value, path, key);
  readString(profile.profile_id, path, `${key}.profile_id`);
  readIntegerInRange(profile.quality_default, path, `${key}.quality_default`, 1, 31);
}

function validateVideoProfile(value: unknown, path: string, key: string): void {
  const profile = readRecord(value, path, key);
  readString(profile.profile_id, path, `${key}.profile_id`);
  readString(profile.ffmpeg_video_codec, path, `${key}.ffmpeg_video_codec`);
  readString(profile.output_codec, path, `${key}.output_codec`);
  readString(profile.pix_fmt, path, `${key}.pix_fmt`);
  readString(profile.movflags, path, `${key}.movflags`);
  readIntegerInRange(profile.crf_default, path, `${key}.crf_default`, 0, 51);
  if (typeof profile.strip_audio !== "boolean") {
    fail(path, `${key}.strip_audio must be a boolean`);
  }
}

function validateExportProfiles(parsed: unknown, path: string): void {
  if (!isRecord(parsed) || !isRecord(parsed.image) || !isRecord(parsed.video)) {
    fail(path, "missing required top-level keys");
  }
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    fail(path, "version must be a non-empty string");
  }

  for (const mode of MODES) {
    const imageMode = readRecord(parsed.image[mode], path, `image.${mode}`);
    const imageFeed = readRecord(imageMode.feed, path, `image.${mode}.feed`);
    for (const orientation of ORIENTATIONS) {
      validateImageProfile(imageFeed[orientation], path, `image.${mode}.feed.${orientation}`);
    }
    validateImageProfile(imageMode.story, path, `image.${mode}.story`);
    validateImageProfile(imageMode.reel, path, `image.${mode}.reel`);

    const videoMode = readRecord(parsed.video[mode], path, `video.${mode}`);
    const videoFeed = readRecord(videoMode.feed, path, `video.${mode}.feed`);
    for (const orientation of ORIENTATIONS) {
      validateVideoProfile(videoFeed[orientation], path, `video.${mode}.feed.${orientation}`);
    }
    validateVideoProfile(videoMode.story, path, `video.${mode}.story`);
    validateVideoProfile(videoMode.reel, path, `video.${mode}.reel`);
  }
}

export function loadExportProfiles(path = DEFAULT_EXPORT_PROFILES_PATH): ExportProfiles {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  validateExportProfiles(parsed, path);
  return parsed as ExportProfiles;
}

export function selectImageExportProfile(
  rules: ExportProfiles,
  input: { mode: Mode; surface: Surface; orientation: Orientation },
): ExportImageProfile {
  if (input.surface === "feed") {
    return rules.image[input.mode].feed[input.orientation];
  }
  return rules.image[input.mode][input.surface];
}

export function selectVideoExportProfile(
  rules: ExportProfiles,
  input: { mode: Mode; surface: Surface; orientation: Orientation },
): ExportVideoProfile {
  if (input.surface === "feed") {
    return rules.video[input.mode].feed[input.orientation];
  }
  return rules.video[input.mode][input.surface];
}
