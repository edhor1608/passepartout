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
    const exportPayload = parseJsonStdout(exportResult.stdout);
    expect(exportPayload.output_width).toBe(1080);
    expect(exportPayload.output_height).toBe(1920);
    expect(exportPayload.output_codec).toBe("h264");
    expect(exportPayload.output_fps).toBe(30);
    expect(exportPayload.output_has_audio).toBe(false);
    expect(exportPayload.output_audio_codec).toBeNull();

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
    expect(payload.output_width).toBe(1080);
    expect(payload.output_height).toBe(1350);
    expect(payload.output_codec).toBe("h264");
    expect(payload.output_fps).toBe(24);
    expect(payload.output_has_audio).toBe(false);
    expect(payload.output_audio_codec).toBeNull();
  });

  test(
    "white-canvas video polaroid_classic applies larger bottom border in filter",
    async () => {
      const input = join(fixtures, "landscape_video_640x360.mov");
      const output = resetOut("landscape_white_canvas_video_classic.mp4");

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
        "--canvas-style",
        "polaroid_classic",
        "--json",
      ]);

      expect(exportResult.exitCode).toBe(0);
      expect(existsSync(output)).toBe(true);

      const payload = parseJsonStdout(exportResult.stdout);
      expect(payload).toHaveProperty(
        "ffmpeg_filter",
        "scale=994:810:force_original_aspect_ratio=decrease,pad=994:810:(ow-iw)/2:(oh-ih)/2:white,pad=1080:1350:43:216:white",
      );
    },
    15000,
  );

  test("white-canvas export-video supports reel surface", async () => {
    const input = join(fixtures, "portrait_video_360x640.mp4");
    const output = resetOut("portrait_white_canvas_reel.mp4");

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
      "--white-canvas",
      "--json",
    ]);

    expect(exportResult.exitCode).toBe(0);
    expect(existsSync(output)).toBe(true);

    const payload = parseJsonStdout(exportResult.stdout);
    expect(payload).toHaveProperty("target_resolution", "1080x1920");
    expect(payload).toHaveProperty("white_canvas_enabled", true);
    expect(payload).toHaveProperty("selected_profile", "reliable_reel_white_canvas_reel_default");
    expect(payload.output_width).toBe(1080);
    expect(payload.output_height).toBe(1920);
  });

  test("export-video strips audio track from audio input", async () => {
    const input = join(fixtures, "portrait_video_audio_360x640.mp4");
    const output = resetOut("portrait_audio_input_stripped.mp4");

    const inputAnalyze = await runAnalyzeCli([
      input,
      "--mode",
      "reliable",
      "--surface",
      "reel",
      "--workflow",
      "unknown",
      "--json",
    ]);
    expect(inputAnalyze.exitCode).toBe(0);
    const inputPayload = parseJsonStdout(inputAnalyze.stdout);
    expect(inputPayload.input?.has_audio).toBe(true);
    expect(inputPayload.input?.audio_codec).not.toBeNull();

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

    const payload = parseJsonStdout(exportResult.stdout);
    expect(payload.output_has_audio).toBe(false);
    expect(payload.output_audio_codec).toBeNull();
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

  test("unsupported output extension fails with explicit error", async () => {
    const input = join(fixtures, "portrait_video_360x640.mp4");
    const output = resetOut("unsupported_output.mkv");
    const result = await runExportVideoCli([
      input,
      "--out",
      output,
      "--mode",
      "reliable",
      "--surface",
      "reel",
      "--json",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("output must be .mp4 or .mov");
  });
});
