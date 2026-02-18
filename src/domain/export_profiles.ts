import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MODES,
  ORIENTATIONS,
  type Mode,
  type Orientation,
  type Surface,
} from "../types/contracts";

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

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_EXPORT_PROFILES_PATH = join(MODULE_DIR, "..", "..", "config", "export_profiles.v1.json");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid export profiles: ${field} must be a non-empty string`);
  }
  return value;
}

function assertNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid export profiles: ${field} must be a finite number`);
  }
  return value;
}

function assertIntegerInRange(value: unknown, field: string, min: number, max: number): number {
  const numeric = assertNumber(value, field);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw new Error(`Invalid export profiles: ${field} must be an integer in [${min}, ${max}]`);
  }
  return numeric;
}

function assertBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid export profiles: ${field} must be a boolean`);
  }
  return value;
}

function assertImageProfile(value: unknown, field: string, ids: Set<string>): ExportImageProfile {
  if (!isRecord(value)) {
    throw new Error(`Invalid export profiles: ${field} must be an object`);
  }
  const profileId = assertString(value.profile_id, `${field}.profile_id`);
  const qualityDefault = assertIntegerInRange(value.quality_default, `${field}.quality_default`, 1, 31);
  if (ids.has(profileId)) {
    throw new Error(`Invalid export profiles: duplicate profile_id '${profileId}'`);
  }
  ids.add(profileId);
  return { profile_id: profileId, quality_default: qualityDefault };
}

function assertVideoProfile(value: unknown, field: string, ids: Set<string>): ExportVideoProfile {
  if (!isRecord(value)) {
    throw new Error(`Invalid export profiles: ${field} must be an object`);
  }
  const profileId = assertString(value.profile_id, `${field}.profile_id`);
  const ffmpegVideoCodec = assertString(value.ffmpeg_video_codec, `${field}.ffmpeg_video_codec`);
  const outputCodec = assertString(value.output_codec, `${field}.output_codec`);
  const pixFmt = assertString(value.pix_fmt, `${field}.pix_fmt`);
  const movflags = assertString(value.movflags, `${field}.movflags`);
  const crfDefault = assertIntegerInRange(value.crf_default, `${field}.crf_default`, 0, 51);
  const stripAudio = assertBoolean(value.strip_audio, `${field}.strip_audio`);
  if (ids.has(profileId)) {
    throw new Error(`Invalid export profiles: duplicate profile_id '${profileId}'`);
  }
  ids.add(profileId);
  return {
    profile_id: profileId,
    ffmpeg_video_codec: ffmpegVideoCodec,
    output_codec: outputCodec,
    pix_fmt: pixFmt,
    movflags,
    crf_default: crfDefault,
    strip_audio: stripAudio,
  };
}

export function assertExportProfilesSchema(value: unknown): ExportProfiles {
  if (!isRecord(value)) {
    throw new Error("Invalid export profiles: root must be an object");
  }
  const version = assertString(value.version, "version");
  if (!isRecord(value.image)) {
    throw new Error("Invalid export profiles: image must be an object");
  }
  if (!isRecord(value.video)) {
    throw new Error("Invalid export profiles: video must be an object");
  }

  const ids = new Set<string>();
  const imageRules = {} as Record<Mode, ExportImageModeRules>;
  const videoRules = {} as Record<Mode, ExportVideoModeRules>;

  for (const mode of MODES) {
    const imageModeRaw = value.image[mode];
    const videoModeRaw = value.video[mode];
    if (!isRecord(imageModeRaw)) {
      throw new Error(`Invalid export profiles: image.${mode} must be an object`);
    }
    if (!isRecord(videoModeRaw)) {
      throw new Error(`Invalid export profiles: video.${mode} must be an object`);
    }

    const imageFeed = imageModeRaw.feed;
    const videoFeed = videoModeRaw.feed;
    if (!isRecord(imageFeed)) {
      throw new Error(`Invalid export profiles: image.${mode}.feed must be an object`);
    }
    if (!isRecord(videoFeed)) {
      throw new Error(`Invalid export profiles: video.${mode}.feed must be an object`);
    }

    const imageFeedRules = {} as Record<Orientation, ExportImageProfile>;
    const videoFeedRules = {} as Record<Orientation, ExportVideoProfile>;
    for (const orientation of ORIENTATIONS) {
      imageFeedRules[orientation] = assertImageProfile(
        imageFeed[orientation],
        `image.${mode}.feed.${orientation}`,
        ids,
      );
      videoFeedRules[orientation] = assertVideoProfile(
        videoFeed[orientation],
        `video.${mode}.feed.${orientation}`,
        ids,
      );
    }

    const storyImage = assertImageProfile(imageModeRaw.story, `image.${mode}.story`, ids);
    const reelImage = assertImageProfile(imageModeRaw.reel, `image.${mode}.reel`, ids);
    const storyVideo = assertVideoProfile(videoModeRaw.story, `video.${mode}.story`, ids);
    const reelVideo = assertVideoProfile(videoModeRaw.reel, `video.${mode}.reel`, ids);

    imageRules[mode] = { feed: imageFeedRules, story: storyImage, reel: reelImage };
    videoRules[mode] = { feed: videoFeedRules, story: storyVideo, reel: reelVideo };
  }

  return {
    version,
    image: imageRules,
    video: videoRules,
  };
}

let cachedProfiles: ExportProfiles | null = null;

export function loadExportProfiles(path = DEFAULT_EXPORT_PROFILES_PATH): ExportProfiles {
  const raw = readFileSync(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid export profiles JSON at ${path}: ${message}`);
  }
  return assertExportProfilesSchema(parsed);
}

export function getDefaultExportProfiles(): ExportProfiles {
  if (!cachedProfiles) {
    cachedProfiles = loadExportProfiles(DEFAULT_EXPORT_PROFILES_PATH);
  }
  return cachedProfiles;
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
