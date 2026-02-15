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
