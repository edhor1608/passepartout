import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseJsonStdout, runBenchmarkCli } from "../helpers/cli";

const fixtures = join(import.meta.dir, "..", "fixtures", "images");
const outDir = join(import.meta.dir, "..", "fixtures", "exports");

function resetOut(name: string): string {
  mkdirSync(outDir, { recursive: true });
  const output = join(outDir, name);
  rmSync(output, { force: true });
  return output;
}

describe("benchmark cli integration", () => {
  test("returns benchmark contract with score and grade", async () => {
    const input = join(fixtures, "portrait_video_audio_360x640.mp4");
    const output = resetOut("benchmark_video.mp4");

    const result = await runBenchmarkCli([
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

    expect(result.exitCode).toBe(0);
    expect(existsSync(output)).toBe(true);

    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("benchmark_version", "v1");
    expect(payload).toHaveProperty("report_export");
    expect(payload).toHaveProperty("score");

    const score = payload.score as Record<string, unknown>;
    expect(typeof score.total).toBe("number");
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
    expect(typeof score.grade).toBe("string");
    expect(["A", "B", "C", "D"]).toContain(score.grade as string);
  });

  test("missing value for --mode fails with explicit error", async () => {
    const input = join(fixtures, "portrait_sample_30x40.png");
    const output = resetOut("benchmark_missing_mode.jpg");

    const result = await runBenchmarkCli([input, "--out", output, "--mode", "--surface", "feed", "--json"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing value for --mode");
  });

  test("flag passed as --out value fails with explicit error", async () => {
    const input = join(fixtures, "portrait_sample_30x40.png");

    const result = await runBenchmarkCli([input, "--out", "--mode", "reliable", "--surface", "feed", "--json"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid value for --out");
  });
});
