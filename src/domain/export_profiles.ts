import { readFileSync } from "node:fs";
import { join } from "node:path";
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

export const DEFAULT_EXPORT_PROFILES_PATH = join(process.cwd(), "config", "export_profiles.v1.json");

export function loadExportProfiles(path = DEFAULT_EXPORT_PROFILES_PATH): ExportProfiles {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as ExportProfiles;
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
