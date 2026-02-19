import { describe, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseJsonStdout, runWatchFolderCli } from "../helpers/cli";

const fixtures = join(import.meta.dir, "..", "fixtures", "images");
const rootDir = join(import.meta.dir, "..", "fixtures", "watch");
const inputDir = join(rootDir, "input");
const outputDir = join(rootDir, "output");

function resetWatchDirs(): void {
  rmSync(rootDir, { recursive: true, force: true });
  mkdirSync(inputDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });
}

describe("watch-folder cli integration", () => {
  test("processes new files in once mode and writes state", async () => {
    resetWatchDirs();
    copyFileSync(
      join(fixtures, "portrait_sample_30x40.png"),
      join(inputDir, "portrait_sample_30x40.png"),
    );
    copyFileSync(
      join(fixtures, "portrait_video_360x640.mp4"),
      join(inputDir, "portrait_video_360x640.mp4"),
    );

    const first = await runWatchFolderCli([
      "--in",
      inputDir,
      "--out",
      outputDir,
      "--mode",
      "reliable",
      "--surface",
      "feed",
      "--workflow",
      "unknown",
      "--once",
      "--json",
    ]);

    expect(first.exitCode).toBe(0);
    const firstPayload = parseJsonStdout(first.stdout);
    expect(firstPayload).toHaveProperty("processed_count", 2);
    expect(firstPayload).toHaveProperty("skipped_count", 0);
    expect(firstPayload).toHaveProperty("error_count", 0);
    expect(existsSync(join(outputDir, ".watch-state.json"))).toBe(true);
    expect(readdirSync(outputDir).some((name) => name.endsWith(".jpg"))).toBe(true);
    expect(readdirSync(outputDir).some((name) => name.endsWith(".mp4"))).toBe(true);

    const second = await runWatchFolderCli([
      "--in",
      inputDir,
      "--out",
      outputDir,
      "--mode",
      "reliable",
      "--surface",
      "feed",
      "--workflow",
      "unknown",
      "--once",
      "--json",
    ]);

    expect(second.exitCode).toBe(0);
    const secondPayload = parseJsonStdout(second.stdout);
    expect(secondPayload).toHaveProperty("processed_count", 0);
    expect(secondPayload).toHaveProperty("skipped_count", 2);
    expect(secondPayload).toHaveProperty("error_count", 0);
    const state = JSON.parse(readFileSync(join(outputDir, ".watch-state.json"), "utf8")) as {
      items: Record<string, unknown>;
    };
    expect(Object.keys(state.items).length).toBe(2);
  });

  test("supports finite polling via max-cycles and returns deterministic cycle outputs", async () => {
    resetWatchDirs();
    copyFileSync(
      join(fixtures, "portrait_sample_30x40.png"),
      join(inputDir, "portrait_sample_30x40.png"),
    );
    copyFileSync(
      join(fixtures, "portrait_video_360x640.mp4"),
      join(inputDir, "portrait_video_360x640.mp4"),
    );

    const run = await runWatchFolderCli([
      "--in",
      inputDir,
      "--out",
      outputDir,
      "--mode",
      "reliable",
      "--surface",
      "feed",
      "--workflow",
      "unknown",
      "--interval-sec",
      "1",
      "--max-cycles",
      "2",
      "--json",
    ]);

    expect(run.exitCode).toBe(0);
    const payloads = run.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(payloads.length).toBe(2);
    expect(payloads[0]).toHaveProperty("processed_count", 2);
    expect(payloads[0]).toHaveProperty("skipped_count", 0);
    expect(payloads[1]).toHaveProperty("processed_count", 0);
    expect(payloads[1]).toHaveProperty("skipped_count", 2);
    expect(payloads[1]).toHaveProperty("once", false);
  });
});
