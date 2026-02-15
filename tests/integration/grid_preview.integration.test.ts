import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseJsonStdout, runGridPreviewCli } from "../helpers/cli";

const outDir = join(import.meta.dir, "..", "fixtures", "exports");

function resetOut(name: string): string {
  mkdirSync(outDir, { recursive: true });
  const output = join(outDir, name);
  rmSync(output, { force: true });
  return output;
}

describe("grid-preview cli integration", () => {
  test("returns deterministic json for 9:16 ratio", async () => {
    const result = await runGridPreviewCli(["--ratio", "9:16", "--json"]);

    expect(result.exitCode).toBe(0);
    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("ratio", "9:16");
    expect(payload).toHaveProperty("canvas_resolution", "1080x1920");
    expect(payload).toHaveProperty("grid_crop_square");
    expect(payload).toHaveProperty("visible_fraction_percent", 56.25);
  });

  test("writes svg file when --out is provided", async () => {
    const output = resetOut("grid_preview_4_5.svg");
    const result = await runGridPreviewCli([
      "--ratio",
      "4:5",
      "--out",
      output,
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    expect(existsSync(output)).toBe(true);
    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("output_svg_path");

    const svg = readFileSync(output, "utf8");
    expect(svg).toContain("viewBox=\"0 0 1080 1350\"");
    expect(svg).toContain("id=\"grid-crop-square\"");
  });
});
