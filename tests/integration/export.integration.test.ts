import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseJsonStdout, runAnalyzeCli, runExportImageCli } from "../helpers/cli";

const fixtures = join(import.meta.dir, "..", "fixtures", "images");
const outDir = join(import.meta.dir, "..", "fixtures", "exports");

function resetOut(name: string): string {
  mkdirSync(outDir, { recursive: true });
  const output = join(outDir, name);
  rmSync(output, { force: true });
  return output;
}

describe("export-image integration", () => {
  test("exports reliable feed portrait to exact target resolution", async () => {
    const input = join(fixtures, "portrait_sample_30x40.png");
    const output = resetOut("portrait_reliable_feed.jpg");

    const exportResult = await runExportImageCli([
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

    expect(exportResult.exitCode).toBe(0);
    expect(existsSync(output)).toBe(true);

    const analyzeResult = await runAnalyzeCli([
      output,
      "--mode",
      "reliable",
      "--surface",
      "feed",
      "--workflow",
      "unknown",
      "--json",
    ]);

    expect(analyzeResult.exitCode).toBe(0);
    const payload = parseJsonStdout(analyzeResult.stdout);
    const inputMeta = payload.input as Record<string, unknown>;
    expect(inputMeta.width).toBe(1080);
    expect(inputMeta.height).toBe(1350);
  });

  test("white-canvas export uses feed canvas target", async () => {
    const input = join(fixtures, "landscape_sample_48x32.jpg");
    const output = resetOut("landscape_white_canvas.jpg");

    const exportResult = await runExportImageCli([
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
});
