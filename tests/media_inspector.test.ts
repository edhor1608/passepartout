import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspectMedia } from "../src/domain/media_inspector";

const fixtures = join(import.meta.dir, "fixtures", "images");
const pixelSnapshots = join(import.meta.dir, "fixtures", "pixel", "snapshots");

describe("media inspector", () => {
  test("reads P3 portrait fixture metadata", () => {
    const path = join(fixtures, "portrait_sample_30x40.ppm");
    const meta = inspectMedia(path);

    expect(meta.width).toBe(30);
    expect(meta.height).toBe(40);
    expect(meta.orientation).toBe("portrait");
    expect(meta.aspect_ratio).toBe("0.7500");
    expect(meta.colorspace).toBe("sRGB");
    expect(meta.codec).toBeNull();
    expect(meta.fps).toBe(0);
    expect(meta.duration_seconds).toBeNull();
    expect(meta.bitrate_kbps).toBeNull();
    expect(meta.has_audio).toBe(false);
    expect(meta.audio_codec).toBeNull();
  });

  test("reads P6 snapshot metadata", () => {
    const path = join(pixelSnapshots, "portrait_sample_30x40.compat.ppm");
    const meta = inspectMedia(path);

    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1350);
    expect(meta.orientation).toBe("portrait");
    expect(meta.duration_seconds).toBeNull();
    expect(meta.bitrate_kbps).toBeNull();
    expect(meta.has_audio).toBe(false);
    expect(meta.audio_codec).toBeNull();
  });

  test("reads PNG fixture metadata", () => {
    const path = join(fixtures, "portrait_sample_30x40.png");
    const meta = inspectMedia(path);

    expect(meta.width).toBe(30);
    expect(meta.height).toBe(40);
    expect(meta.orientation).toBe("portrait");
    expect(meta.aspect_ratio).toBe("0.7500");
    expect(meta.colorspace).toBe("unknown");
    expect(meta.duration_seconds).toBeNull();
    expect(meta.bitrate_kbps).toBeNull();
    expect(meta.has_audio).toBe(false);
    expect(meta.audio_codec).toBeNull();
  });

  test("reads JPEG fixture metadata", () => {
    const path = join(fixtures, "landscape_sample_48x32.jpg");
    const meta = inspectMedia(path);

    expect(meta.width).toBe(48);
    expect(meta.height).toBe(32);
    expect(meta.orientation).toBe("landscape");
    expect(meta.aspect_ratio).toBe("1.5000");
    expect(meta.colorspace).toBe("unknown");
    expect(meta.duration_seconds).toBeNull();
    expect(meta.bitrate_kbps).toBeNull();
    expect(meta.has_audio).toBe(false);
    expect(meta.audio_codec).toBeNull();
  });

  test("reads MP4 fixture metadata", () => {
    const path = join(fixtures, "portrait_video_360x640.mp4");
    const meta = inspectMedia(path);

    expect(meta.width).toBe(360);
    expect(meta.height).toBe(640);
    expect(meta.orientation).toBe("portrait");
    expect(meta.aspect_ratio).toBe("0.5625");
    expect(meta.codec).toContain("h264");
    expect(meta.fps).toBe(30);
    expect(meta.duration_seconds).toBe(1);
    expect(meta.bitrate_kbps).toBeGreaterThan(0);
    expect(meta.has_audio).toBe(false);
    expect(meta.audio_codec).toBeNull();
  });

  test("reads MOV fixture metadata", () => {
    const path = join(fixtures, "landscape_video_640x360.mov");
    const meta = inspectMedia(path);

    expect(meta.width).toBe(640);
    expect(meta.height).toBe(360);
    expect(meta.orientation).toBe("landscape");
    expect(meta.aspect_ratio).toBe("1.7778");
    expect(meta.codec).toContain("h264");
    expect(meta.fps).toBe(24);
    expect(meta.duration_seconds).toBe(1);
    expect(meta.bitrate_kbps).toBeGreaterThan(0);
    expect(meta.has_audio).toBe(false);
    expect(meta.audio_codec).toBeNull();
  });

  test("reads MP4 fixture with audio metadata", () => {
    const path = join(fixtures, "portrait_video_audio_360x640.mp4");
    const meta = inspectMedia(path);

    expect(meta.width).toBe(360);
    expect(meta.height).toBe(640);
    expect(meta.orientation).toBe("portrait");
    expect(meta.aspect_ratio).toBe("0.5625");
    expect(meta.codec).toContain("h264");
    expect(meta.fps).toBe(30);
    expect(meta.duration_seconds).toBe(1);
    expect(meta.bitrate_kbps).toBeGreaterThan(0);
    expect(meta.has_audio).toBe(true);
    expect(meta.audio_codec).toBe("aac");
  });

  test("fails for unsupported extension", () => {
    expect(() => inspectMedia("/tmp/input.gif")).toThrow("Unsupported media format");
  });

  test("preserves caller-provided path string", () => {
    const relativePath = "tests/fixtures/images/portrait_sample_30x40.ppm";
    const meta = inspectMedia(relativePath);
    expect(meta.path).toBe(relativePath);
  });

  test("reads PPM dimensions when header comments exceed initial chunk size", () => {
    const dir = mkdtempSync(join(tmpdir(), "passepartout-media-"));
    const path = join(dir, "long-header.ppm");
    const longComment = "# ".concat("x".repeat((16 * 1024) + 128));
    writeFileSync(path, `P3\n${longComment}\n3 2\n255\n0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n`, "utf8");

    const meta = inspectMedia(path);
    expect(meta.width).toBe(3);
    expect(meta.height).toBe(2);
  });
});
