import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  assertExportProfilesSchema,
  loadExportProfiles,
  selectImageExportProfile,
  selectVideoExportProfile,
} from "../src/domain/export_profiles";

describe("export profiles", () => {
  const profiles = loadExportProfiles();

  test("selects reliable feed landscape image profile", () => {
    const profile = selectImageExportProfile(profiles, {
      mode: "reliable",
      surface: "feed",
      orientation: "landscape",
    });

    expect(profile.profile_id).toBe("img_reliable_feed_landscape_v1");
    expect(profile.quality_default).toBe(2);
  });

  test("selects experimental story image profile", () => {
    const profile = selectImageExportProfile(profiles, {
      mode: "experimental",
      surface: "story",
      orientation: "portrait",
    });

    expect(profile.profile_id).toBe("img_experimental_story_v1");
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

  test("selects experimental feed square video profile", () => {
    const profile = selectVideoExportProfile(profiles, {
      mode: "experimental",
      surface: "feed",
      orientation: "square",
    });

    expect(profile.profile_id).toBe("vid_experimental_feed_square_v1");
    expect(profile.crf_default).toBe(23);
    expect(profile.strip_audio).toBe(true);
  });

  test("schema rejects duplicate profile IDs", () => {
    const cloned = structuredClone(profiles) as Record<string, unknown>;
    const image = cloned.image as Record<string, unknown>;
    const reliable = image.reliable as Record<string, unknown>;
    const feed = reliable.feed as Record<string, unknown>;
    const portrait = feed.portrait as Record<string, unknown>;
    portrait.profile_id = "img_reliable_feed_square_v1";

    expect(() => assertExportProfilesSchema(cloned)).toThrow("duplicate profile_id");
  });

  test("schema rejects image quality_default out of range", () => {
    const cloned = structuredClone(profiles) as Record<string, unknown>;
    const image = cloned.image as Record<string, unknown>;
    const reliable = image.reliable as Record<string, unknown>;
    const feed = reliable.feed as Record<string, unknown>;
    const portrait = feed.portrait as Record<string, unknown>;
    portrait.quality_default = 32;

    expect(() => assertExportProfilesSchema(cloned)).toThrow("quality_default");
  });

  test("schema rejects video crf_default out of range", () => {
    const cloned = structuredClone(profiles) as Record<string, unknown>;
    const video = cloned.video as Record<string, unknown>;
    const reliable = video.reliable as Record<string, unknown>;
    const reel = reliable.reel as Record<string, unknown>;
    reel.crf_default = -1;

    expect(() => assertExportProfilesSchema(cloned)).toThrow("crf_default");
  });

  test("schema rejects missing mode surface branch", () => {
    const cloned = structuredClone(profiles) as Record<string, unknown>;
    const video = cloned.video as Record<string, unknown>;
    const reliable = video.reliable as Record<string, unknown>;
    reliable.feed = {};

    expect(() => assertExportProfilesSchema(cloned)).toThrow("video.reliable.feed.portrait");
  });

  test("loadExportProfiles wraps JSON parsing errors with file path", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "passepartout-export-profiles-"));
    const invalidFile = join(tempDir, "invalid.json");
    writeFileSync(invalidFile, "{this is not valid json", "utf8");

    try {
      expect(() => loadExportProfiles(invalidFile)).toThrow(`Invalid export profiles JSON at ${invalidFile}`);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
