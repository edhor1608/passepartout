import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_EXPORT_PROFILES_PATH,
  loadExportProfiles,
  selectImageExportProfile,
  selectVideoExportProfile,
} from "../src/domain/export_profiles";

describe("export profiles", () => {
  const profiles = loadExportProfiles();

  test("loads default export profiles from module-relative path", () => {
    expect(DEFAULT_EXPORT_PROFILES_PATH.endsWith("config/export_profiles.v1.json")).toBe(true);
    expect(profiles.version).toBe("1.0.0");
  });

  test("throws clear error for invalid export profile shape", () => {
    const dir = mkdtempSync(join(tmpdir(), "passepartout-export-profiles-"));
    const file = join(dir, "broken.json");
    writeFileSync(file, JSON.stringify({ version: "1.0.0" }), "utf8");

    expect(() => loadExportProfiles(file)).toThrow(
      `Invalid export profiles at ${file}: missing required top-level keys`,
    );
  });

  test("selects reliable feed landscape image profile", () => {
    const profile = selectImageExportProfile(profiles, {
      mode: "reliable",
      surface: "feed",
      orientation: "landscape",
    });

    expect(profile.profile_id).toBe("img_reliable_feed_landscape_v1");
    expect(profile.quality_default).toBe(2);
  });

  test("selects reliable reel video profile", () => {
    const profile = selectVideoExportProfile(profiles, {
      mode: "reliable",
      surface: "reel",
      orientation: "portrait",
    });

    expect(profile.profile_id).toBe("vid_reliable_reel_v1");
    expect(profile.crf_default).toBe(23);
    expect(profile.ffmpeg_video_codec).toBe("libx264");
    expect(profile.output_codec).toBe("h264");
  });
});
