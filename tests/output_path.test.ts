import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePrepareImageOutputPath } from "../src/domain/output_path";

describe("prepare image output path", () => {
  test("adds .jpg when no extension is provided and creates parents", () => {
    const dir = mkdtempSync(join(tmpdir(), "passepartout-output-path-"));
    const outputPath = resolvePrepareImageOutputPath(join(dir, "exports", "photo"));

    expect(outputPath).toBe(join(dir, "exports", "photo.jpg"));
    expect(existsSync(join(dir, "exports"))).toBe(true);
  });

  test("replaces non-jpeg extensions with .jpg", () => {
    const dir = mkdtempSync(join(tmpdir(), "passepartout-output-path-"));

    expect(resolvePrepareImageOutputPath(join(dir, "photo.png"))).toBe(join(dir, "photo.jpg"));
    expect(resolvePrepareImageOutputPath(join(dir, "photo.jpeg"))).toBe(join(dir, "photo.jpg"));
  });

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
