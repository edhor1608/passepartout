import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
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
    const reportPath = join(exportsDir, "matrix_basic_report.json");
    rmSync(reportPath, { force: true });

    const result = await runValidateMatrixCli(["--cases", casesFile, "--out-json", reportPath, "--json"]);
    expect(result.exitCode).toBe(0);

    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("matrix_version", "v1");
    expect(payload).toHaveProperty("cases_total", 2);
    expect(payload).toHaveProperty("cases_succeeded", 2);
    expect(payload).toHaveProperty("cases_failed", 0);
    expect(payload).toHaveProperty("summary");

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

    const summary = payload.summary as Record<string, unknown>;
    expect(typeof summary.avg_total_score).toBe("number");
    expect(typeof summary.avg_confidence).toBe("number");

    const gradeCounts = summary.grade_counts as Record<string, unknown>;
    expect(typeof gradeCounts.A).toBe("number");
    expect(typeof gradeCounts.B).toBe("number");
    expect(typeof gradeCounts.C).toBe("number");
    expect(typeof gradeCounts.D).toBe("number");

    const confidenceCounts = summary.confidence_counts as Record<string, unknown>;
    expect(typeof confidenceCounts.low).toBe("number");
    expect(typeof confidenceCounts.medium).toBe("number");
    expect(typeof confidenceCounts.high).toBe("number");

    expect(existsSync(join(exportsDir, "matrix_basic_portrait.jpg"))).toBe(true);
    expect(existsSync(join(exportsDir, "matrix_basic_reel.mp4"))).toBe(true);
    expect(existsSync(reportPath)).toBe(true);
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, unknown>;
    expect(report).toHaveProperty("matrix_version", "v1");
    expect(report).toHaveProperty("cases_total", 2);
  });
});
