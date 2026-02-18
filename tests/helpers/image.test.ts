import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { diffRgb, readP3Image } from "./image";

describe("image helpers", () => {
  test("readP3Image ignores full-line and inline comments", () => {
    const dir = mkdtempSync(join(tmpdir(), "passepartout-image-"));
    const file = join(dir, "commented.ppm");
    writeFileSync(
      file,
      [
        "P3",
        "# full line comment with tokens 1 2 3",
        "2 1",
        "255 # inline comment with text 4 5 6",
        "255 0 0  0 255 0",
      ].join("\n"),
      "utf8",
    );

    const image = readP3Image(file);
    expect(image.width).toBe(2);
    expect(image.height).toBe(1);
    expect(Array.from(image.pixels)).toEqual([255, 0, 0, 0, 255, 0]);
  });

  test("diffRgb meanChannelDelta is computed per pixel", () => {
    const a = { width: 1, height: 1, pixels: new Uint8Array([0, 0, 0]) };
    const b = { width: 1, height: 1, pixels: new Uint8Array([1, 2, 3]) };
    const diff = diffRgb(a, b);

    expect(diff.mismatchPixels).toBe(1);
    expect(diff.maxChannelDelta).toBe(3);
    expect(diff.meanChannelDelta).toBe(6);
  });
});
