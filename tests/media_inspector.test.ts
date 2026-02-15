import { describe, expect, test } from "bun:test";
import { join } from "node:path";
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
  });

  test("reads P6 snapshot metadata", () => {
    const path = join(pixelSnapshots, "portrait_sample_30x40.compat.ppm");
    const meta = inspectMedia(path);

    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1350);
    expect(meta.orientation).toBe("portrait");
  });

  test("reads PNG fixture metadata", () => {
    const path = join(fixtures, "portrait_sample_30x40.png");
    const meta = inspectMedia(path);

    expect(meta.width).toBe(30);
    expect(meta.height).toBe(40);
    expect(meta.orientation).toBe("portrait");
    expect(meta.aspect_ratio).toBe("0.7500");
    expect(meta.colorspace).toBe("unknown");
  });

  test("reads JPEG fixture metadata", () => {
    const path = join(fixtures, "landscape_sample_48x32.jpg");
    const meta = inspectMedia(path);

    expect(meta.width).toBe(48);
    expect(meta.height).toBe(32);
    expect(meta.orientation).toBe("landscape");
    expect(meta.aspect_ratio).toBe("1.5000");
    expect(meta.colorspace).toBe("unknown");
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
  });

  test("fails for unsupported extension", () => {
    expect(() => inspectMedia("/tmp/input.gif")).toThrow("Unsupported media format");
  });
});
