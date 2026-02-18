import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { parseJsonStdout, runAnalyzeCli } from "../helpers/cli";

const fixtures = join(import.meta.dir, "..", "fixtures", "images");

describe("analyze cli integration", () => {
  test("returns analyze contract in json", async () => {
    const file = join(fixtures, "landscape_sample_48x32.ppm");
    const result = await runAnalyzeCli([
      file,
      "--mode",
      "reliable",
      "--surface",
      "feed",
      "--workflow",
      "unknown",
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("input");
    expect(payload).toHaveProperty("selection");
    expect(payload).toHaveProperty("tier");
    expect(payload).toHaveProperty("white_canvas");
  });

  test("white-canvas analyze computes margins", async () => {
    const file = join(fixtures, "landscape_sample_48x32.ppm");
    const result = await runAnalyzeCli([
      file,
      "--mode",
      "reliable",
      "--surface",
      "feed",
      "--workflow",
      "unknown",
      "--white-canvas",
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    const payload = parseJsonStdout(result.stdout);
    const whiteCanvas = payload.white_canvas as Record<string, unknown>;
    expect(whiteCanvas.enabled).toBe(true);
    expect(whiteCanvas.margins).toEqual({ left: 43, top: 216, right: 43, bottom: 216 });
  });

  test("missing value for --mode fails with explicit error", async () => {
    const file = join(fixtures, "landscape_sample_48x32.ppm");
    const result = await runAnalyzeCli([file, "--mode", "--surface", "feed", "--json"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Missing value for --mode");
  });

  test("missing value for --canvas-profile fails with explicit error", async () => {
    const file = join(fixtures, "landscape_sample_48x32.ppm");
    const result = await runAnalyzeCli([
      file,
      "--mode",
      "reliable",
      "--surface",
      "feed",
      "--white-canvas",
      "--canvas-profile",
      "--json",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Missing value for --canvas-profile");
  });
});
