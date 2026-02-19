import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseJsonStdout, runReportExportCli } from "../helpers/cli";

const fixtures = join(import.meta.dir, "..", "fixtures", "images");
const outDir = join(import.meta.dir, "..", "fixtures", "exports");

function resetOut(name: string): string {
  mkdirSync(outDir, { recursive: true });
  const output = join(outDir, name);
  rmSync(output, { force: true });
  return output;
}

describe("report-export cli integration", () => {
  test("image input returns comparison report and exported artifact", async () => {
    const input = join(fixtures, "portrait_sample_30x40.png");
    const output = resetOut("report_export_image.jpg");

    const result = await runReportExportCli([
      input,
      "--out",
      output,
      "--mode",
      "reliable",
      "--surface",
      "feed",
      "--workflow",
      "unknown",
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    expect(existsSync(output)).toBe(true);

    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("input_analyze");
    expect(payload).toHaveProperty("export");
    expect(payload).toHaveProperty("output_analyze");
    expect(payload).toHaveProperty("comparison");

    const comparison = payload.comparison as Record<string, unknown>;
    expect(comparison.output_matches_target).toBe(true);
    expect(comparison.output_resolution).toBe("1080x1350");
    expect(typeof comparison.psnr_db).toBe("number");
    expect((comparison.psnr_db as number) >= 0).toBe(true);
    expect(typeof comparison.ssim).toBe("number");
    expect((comparison.ssim as number) >= 0 && (comparison.ssim as number) <= 1).toBe(true);
  });

  test("video input includes bitrate delta in comparison", async () => {
    const input = join(fixtures, "portrait_video_audio_360x640.mp4");
    const output = resetOut("report_export_video.mp4");

    const result = await runReportExportCli([
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
    const comparison = payload.comparison as Record<string, unknown>;
    expect(comparison.output_matches_target).toBe(true);
    expect(comparison.output_resolution).toBe("1080x1920");
    expect(typeof comparison.bitrate_delta_kbps).toBe("number");
    expect(typeof comparison.psnr_db).toBe("number");
    expect(typeof comparison.ssim).toBe("number");
  });
});
