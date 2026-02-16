import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseJsonStdout, runValidateMatrixCli } from "../helpers/cli";

const fixturesDir = join(import.meta.dir, "..", "fixtures");
const casesFile = join(fixturesDir, "matrix", "cases_basic.json");
const failureCasesFile = join(fixturesDir, "matrix", "cases_with_failure.json");
const exportsDir = join(fixturesDir, "exports");

describe("validate-matrix cli integration", () => {
  test("runs all matrix cases and returns deterministic summary", async () => {
    mkdirSync(exportsDir, { recursive: true });
    rmSync(join(exportsDir, "matrix_basic_portrait.jpg"), { force: true });
    rmSync(join(exportsDir, "matrix_basic_reel.mp4"), { force: true });
    const reportPath = join(exportsDir, "matrix_basic_report.json");
    const summaryPath = join(exportsDir, "matrix_basic_summary.md");
    rmSync(reportPath, { force: true });
    rmSync(summaryPath, { force: true });

    const result = await runValidateMatrixCli([
      "--cases",
      casesFile,
      "--out-json",
      reportPath,
      "--out-md",
      summaryPath,
      "--json",
    ]);
    expect(result.exitCode).toBe(0);

    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("matrix_version", "v1");
    expect(payload).toHaveProperty("cases_total", 2);
    expect(payload).toHaveProperty("cases_succeeded", 2);
    expect(payload).toHaveProperty("cases_failed", 0);
    expect(typeof payload.duration_ms).toBe("number");
    expect((payload.duration_ms as number) >= 0).toBe(true);
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
    expect(typeof first.duration_ms).toBe("number");
    expect(typeof second.duration_ms).toBe("number");
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
    expect(existsSync(summaryPath)).toBe(true);
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, unknown>;
    expect(report).toHaveProperty("matrix_version", "v1");
    expect(report).toHaveProperty("cases_total", 2);
    const summaryMarkdown = readFileSync(summaryPath, "utf8");
    expect(summaryMarkdown.includes("# Validate Matrix Report")).toBe(true);
    expect(summaryMarkdown.includes("Cases total: 2")).toBe(true);
  });

  test("keeps exit code zero by default when some cases fail", async () => {
    rmSync(join(exportsDir, "matrix_fail_portrait.jpg"), { force: true });

    const result = await runValidateMatrixCli(["--cases", failureCasesFile, "--json"]);
    expect(result.exitCode).toBe(0);

    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("cases_total", 2);
    expect(payload).toHaveProperty("cases_succeeded", 1);
    expect(payload).toHaveProperty("cases_failed", 1);
    expect(typeof payload.duration_ms).toBe("number");
  });

  test("returns non-zero with --fail-on-error when some cases fail", async () => {
    const result = await runValidateMatrixCli(["--cases", failureCasesFile, "--fail-on-error", "--json"]);
    expect(result.exitCode).toBe(1);

    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("cases_total", 2);
    expect(payload).toHaveProperty("cases_succeeded", 1);
    expect(payload).toHaveProperty("cases_failed", 1);
    expect(typeof payload.duration_ms).toBe("number");
  });

  test("runs only selected case ids with --only filter", async () => {
    const portraitOut = join(exportsDir, "matrix_basic_portrait.jpg");
    const reelOut = join(exportsDir, "matrix_basic_reel.mp4");
    rmSync(portraitOut, { force: true });
    rmSync(reelOut, { force: true });

    const result = await runValidateMatrixCli([
      "--cases",
      casesFile,
      "--only",
      "matrix-basic-reliable-feed-portrait",
      "--json",
    ]);
    expect(result.exitCode).toBe(0);

    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("cases_total", 1);
    expect(payload).toHaveProperty("cases_succeeded", 1);
    expect(payload).toHaveProperty("cases_failed", 0);
    expect(existsSync(portraitOut)).toBe(true);
    expect(existsSync(reelOut)).toBe(false);
  });

  test("returns non-zero when --only includes unknown case ids", async () => {
    const result = await runValidateMatrixCli([
      "--cases",
      casesFile,
      "--only",
      "matrix-basic-reliable-feed-portrait,missing-case-id",
      "--json",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr.includes("Unknown case id(s) in --only: missing-case-id")).toBe(true);
  });
});
