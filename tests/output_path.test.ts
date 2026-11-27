import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePrepareImageOutputPath } from "../src/domain/output_path";

describe("prepare image output path", () => {
  test("rejects existing directories", () => {
    const dir = mkdtempSync(join(tmpdir(), "passepartout-output-path-"));

    expect(() => resolvePrepareImageOutputPath(dir)).toThrow(
      "--out must be a file path, not a directory",
    );
  });

  test("suffixes existing files without overwriting", () => {
    const dir = mkdtempSync(join(tmpdir(), "passepartout-output-path-"));
    writeFileSync(join(dir, "photo.jpg"), "");
    writeFileSync(join(dir, "photo-1.jpg"), "");

    expect(resolvePrepareImageOutputPath(join(dir, "photo.jpg"))).toBe(join(dir, "photo-2.jpg"));
  });
});
