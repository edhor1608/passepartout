import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { parseJsonStdout, runReportCli } from "../helpers/cli";

const fixtures = join(import.meta.dir, "..", "fixtures", "images");

describe("report cli integration", () => {
  test("returns report contract in json", async () => {
    const file = join(fixtures, "portrait_sample_30x40.png");
    const result = await runReportCli([
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
    expect(payload).toHaveProperty("analyze");
    expect(payload).toHaveProperty("checks");
    expect(payload).toHaveProperty("next_actions");
  });

  test("audio check passes for video with audio", async () => {
    const file = join(fixtures, "portrait_video_audio_360x640.mp4");
    const result = await runReportCli([
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
    const checks = payload.checks as Array<Record<string, unknown>>;
    const audioCheck = checks.find((item) => item.id === "audio_present");
    expect(audioCheck).toBeDefined();
    expect(audioCheck?.status).toBe("pass");
  });

  test("audio check warns for video without audio", async () => {
    const file = join(fixtures, "portrait_video_360x640.mp4");
    const result = await runReportCli([
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
    const checks = payload.checks as Array<Record<string, unknown>>;
    const audioCheck = checks.find((item) => item.id === "audio_present");
    expect(audioCheck).toBeDefined();
    expect(audioCheck?.status).toBe("warn");
  });
});
