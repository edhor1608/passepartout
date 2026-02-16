import { describe, expect, test } from "bun:test";
import { loadExportProfiles, selectImageExportProfile, selectVideoExportProfile } from "../src/domain/export_profiles";

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
