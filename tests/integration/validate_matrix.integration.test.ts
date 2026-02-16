import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseJsonStdout, runValidateMatrixCli } from "../helpers/cli";

const fixturesDir = join(import.meta.dir, "..", "fixtures");
const casesFile = join(fixturesDir, "matrix", "cases_basic.json");
const exportsDir = join(fixturesDir, "exports");

describe("validate-matrix cli integration", () => {
  test("runs all matrix cases and returns deterministic summary", async () => {
    mkdirSync(exportsDir, { recursive: true });
    rmSync(join(exportsDir, "matrix_basic_portrait.jpg"), { force: true });
    rmSync(join(exportsDir, "matrix_basic_reel.mp4"), { force: true });

    const result = await runValidateMatrixCli(["--cases", casesFile, "--json"]);
    expect(result.exitCode).toBe(0);

    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("matrix_version", "v1");
    expect(payload).toHaveProperty("cases_total", 2);
    expect(payload).toHaveProperty("cases_succeeded", 2);
    expect(payload).toHaveProperty("cases_failed", 0);

    const results = payload.results as Array<Record<string, unknown>>;
    expect(results.length).toBe(2);
    const first = results[0];
    const second = results[1];
    if (!first || !second) {
      throw new Error("expected two matrix results");
    }
    expect(first).toHaveProperty("status", "ok");
    expect(second).toHaveProperty("status", "ok");
    expect((first.benchmark as Record<string, unknown>).benchmark_version).toBe("v1");
    expect((second.benchmark as Record<string, unknown>).benchmark_version).toBe("v1");

    expect(existsSync(join(exportsDir, "matrix_basic_portrait.jpg"))).toBe(true);
    expect(existsSync(join(exportsDir, "matrix_basic_reel.mp4"))).toBe(true);
  });
});
