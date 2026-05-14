import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectMedia } from "../../src/domain/media_inspector";
import { runPrepareImageCli } from "../helpers/cli";

const outDir = mkdtempSync(join(tmpdir(), "passepartout-prepare-image-"));

describe("prepare-image cli", () => {
  test("prints minimal help", async () => {
    const result = await runPrepareImageCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Usage: bun run prepare-image <input> --out <file-path> [--border-px <integer>]\n");
    expect(result.stderr).toBe("");
  });

  test("exports a PNG as a JPEG and prints the actual output path", async () => {
    const requestedOut = join(outDir, "photo.png");
    const result = await runPrepareImageCli([
      "tests/fixtures/images/landscape_sample_48x32.png",
      "--out",
      requestedOut,
      "--border-px",
      "0",
    ]);

    const actualOut = join(outDir, "photo.jpg");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(`${actualOut}\n`);
    expect(result.stderr).toBe("");
    expect(existsSync(actualOut)).toBe(true);
    expect(inspectMedia(actualOut)).toMatchObject({ height: 32, width: 48 });
  });
});
