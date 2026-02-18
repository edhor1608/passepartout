import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { diffRgb, readP3Image, readP6Image } from "./image";

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

  test("readP6Image ignores comment after max token", () => {
    const dir = mkdtempSync(join(tmpdir(), "passepartout-image-"));
    const file = join(dir, "commented.p6.ppm");
    const header = Buffer.from("P6\n1 1\n255 # trailing header comment\n", "ascii");
    const payload = Uint8Array.from([1, 2, 3]);
    const data = new Uint8Array(header.length + payload.length);
    data.set(header, 0);
    data.set(payload, header.length);
    writeFileSync(file, data);

    const image = readP6Image(file);
    expect(image.width).toBe(1);
    expect(image.height).toBe(1);
    expect(Array.from(image.pixels)).toEqual([1, 2, 3]);
  });
});
