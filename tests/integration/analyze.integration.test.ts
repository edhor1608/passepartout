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

  test("analyze supports PNG input", async () => {
    const file = join(fixtures, "portrait_sample_30x40.png");
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
    const input = payload.input as Record<string, unknown>;
    expect(input.width).toBe(30);
    expect(input.height).toBe(40);
    expect(input.orientation).toBe("portrait");
  });

  test("analyze supports MP4 input", async () => {
    const file = join(fixtures, "portrait_video_360x640.mp4");
    const result = await runAnalyzeCli([
      file,
      "--mode",
      "reliable",
      "--surface",
      "reel",
      "--workflow",
      "unknown",
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    const payload = parseJsonStdout(result.stdout);
    const input = payload.input as Record<string, unknown>;
    expect(input.width).toBe(360);
    expect(input.height).toBe(640);
    expect(input.orientation).toBe("portrait");
    expect(input.codec).toBe("h264");
    expect(input.fps).toBe(30);
    expect(input.duration_seconds).toBe(1);
    expect(input.bitrate_kbps).toBeGreaterThan(0);
    expect(input.has_audio).toBe(false);
    expect(input.audio_codec).toBeNull();
  });

  test("analyze exposes audio metadata for MP4 with audio track", async () => {
    const file = join(fixtures, "portrait_video_audio_360x640.mp4");
    const result = await runAnalyzeCli([
      file,
      "--mode",
      "reliable",
      "--surface",
      "reel",
      "--workflow",
      "unknown",
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    const payload = parseJsonStdout(result.stdout);
    const input = payload.input as Record<string, unknown>;
    expect(input.width).toBe(360);
    expect(input.height).toBe(640);
    expect(input.orientation).toBe("portrait");
    expect(input.codec).toBe("h264");
    expect(input.fps).toBe(30);
    expect(input.duration_seconds).toBe(1);
    expect(input.bitrate_kbps).toBeGreaterThan(0);
    expect(input.has_audio).toBe(true);
    expect(input.audio_codec).toBe("aac");
  });
});
