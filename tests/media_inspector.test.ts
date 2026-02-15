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

  test("fails for unsupported extension", () => {
    expect(() => inspectMedia("/tmp/input.jpg")).toThrow("Unsupported media format");
  });
});
