import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseJsonStdout, runAnalyzeCli, runExportVideoCli } from "../helpers/cli";

const fixtures = join(import.meta.dir, "..", "fixtures", "images");
const outDir = join(import.meta.dir, "..", "fixtures", "exports");

function resetOut(name: string): string {
  mkdirSync(outDir, { recursive: true });
  const output = join(outDir, name);
  rmSync(output, { force: true });
  return output;
}

describe("export-video integration", () => {
  test("exports reliable reel portrait video to exact target resolution", async () => {
    const input = join(fixtures, "portrait_video_360x640.mp4");
    const output = resetOut("portrait_reliable_reel.mp4");

    const exportResult = await runExportVideoCli([
      input,
      "--out",
      output,
      "--mode",
      "reliable",
      "--surface",
      "reel",
      "--workflow",
      "unknown",
      "--json",
    ]);

    expect(exportResult.exitCode).toBe(0);
    expect(existsSync(output)).toBe(true);

    const analyzeResult = await runAnalyzeCli([
      output,
      "--mode",
      "reliable",
      "--surface",
      "reel",
      "--workflow",
      "unknown",
      "--json",
    ]);

    expect(analyzeResult.exitCode).toBe(0);
    const payload = parseJsonStdout(analyzeResult.stdout);
    const inputMeta = payload.input as Record<string, unknown>;
    expect(inputMeta.width).toBe(1080);
    expect(inputMeta.height).toBe(1920);
    expect(inputMeta.orientation).toBe("portrait");
    expect(inputMeta.codec).toBe("h264");
  });

  test("white-canvas export-video uses feed canvas target", async () => {
    const input = join(fixtures, "landscape_video_640x360.mov");
    const output = resetOut("landscape_white_canvas_video.mp4");

    const exportResult = await runExportVideoCli([
      input,
      "--out",
      output,
      "--mode",
      "reliable",
      "--surface",
      "feed",
      "--workflow",
      "unknown",
      "--white-canvas",
      "--canvas-profile",
      "feed_compat",
      "--json",
    ]);

    expect(exportResult.exitCode).toBe(0);
    expect(existsSync(output)).toBe(true);

    const payload = parseJsonStdout(exportResult.stdout);
    expect(payload).toHaveProperty("target_resolution", "1080x1350");
    expect(payload).toHaveProperty("white_canvas_enabled", true);
  });

  test("missing value for --mode fails with explicit error", async () => {
    const input = join(fixtures, "portrait_video_360x640.mp4");
    const output = resetOut("video_missing_mode.mp4");
    const result = await runExportVideoCli([input, "--out", output, "--mode", "--surface", "reel", "--json"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Missing value for --mode");
  });

  test("missing value for --crf fails with explicit error", async () => {
    const input = join(fixtures, "portrait_video_360x640.mp4");
    const output = resetOut("video_missing_crf.mp4");
    const result = await runExportVideoCli([
      input,
      "--out",
      output,
      "--mode",
      "reliable",
      "--surface",
      "reel",
      "--crf",
      "--json",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Missing value for --crf");
  });
});
