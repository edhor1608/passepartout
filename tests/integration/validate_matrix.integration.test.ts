import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseJsonStdout, runValidateMatrixCli } from "../helpers/cli";

const fixturesDir = join(import.meta.dir, "..", "fixtures");
const casesFile = join(fixturesDir, "matrix", "cases_basic.json");
const failureCasesFile = join(fixturesDir, "matrix", "cases_with_failure.json");
const onlyPortraitFile = join(fixturesDir, "matrix", "only_portrait.txt");
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
    expect(payload).toHaveProperty("cases_skipped", 0);
    expect(payload).toHaveProperty("selected_case_ids");
    expect(typeof payload.duration_ms).toBe("number");
    expect((payload.duration_ms as number) >= 0).toBe(true);
    expect(payload).toHaveProperty("summary");
    expect(payload.selected_case_ids).toEqual([
      "matrix-basic-reliable-feed-portrait",
      "matrix-basic-reliable-reel-video",
    ]);

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
    expect(payload).toHaveProperty("cases_skipped", 1);
    expect(payload.selected_case_ids).toEqual(["matrix-basic-reliable-feed-portrait"]);
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
    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("error", "Unknown case id(s) in --only: missing-case-id");
  });

  test("runs selected case ids from --only-file", async () => {
    const portraitOut = join(exportsDir, "matrix_basic_portrait.jpg");
    const reelOut = join(exportsDir, "matrix_basic_reel.mp4");
    rmSync(portraitOut, { force: true });
    rmSync(reelOut, { force: true });

    const result = await runValidateMatrixCli([
      "--cases",
      casesFile,
      "--only-file",
      onlyPortraitFile,
      "--json",
    ]);
    expect(result.exitCode).toBe(0);

    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("cases_total", 1);
    expect(payload).toHaveProperty("cases_skipped", 1);
    expect(payload.selected_case_ids).toEqual(["matrix-basic-reliable-feed-portrait"]);
    expect(existsSync(portraitOut)).toBe(true);
    expect(existsSync(reelOut)).toBe(false);
  });

  test("returns non-zero when --only and --only-file are both provided", async () => {
    const result = await runValidateMatrixCli([
      "--cases",
      casesFile,
      "--only",
      "matrix-basic-reliable-feed-portrait",
      "--only-file",
      onlyPortraitFile,
      "--json",
    ]);
    expect(result.exitCode).toBe(1);

    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("error", "Cannot combine --only with --only-file");
  });

  test("limits execution to first N cases with --max-cases", async () => {
    const portraitOut = join(exportsDir, "matrix_basic_portrait.jpg");
    const reelOut = join(exportsDir, "matrix_basic_reel.mp4");
    rmSync(portraitOut, { force: true });
    rmSync(reelOut, { force: true });

    const result = await runValidateMatrixCli([
      "--cases",
      casesFile,
      "--max-cases",
      "1",
      "--json",
    ]);
    expect(result.exitCode).toBe(0);

    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("cases_total", 1);
    expect(payload.selected_case_ids).toEqual(["matrix-basic-reliable-feed-portrait"]);
    expect(existsSync(portraitOut)).toBe(true);
    expect(existsSync(reelOut)).toBe(false);
  });

  test("returns non-zero for invalid --max-cases values", async () => {
    const result = await runValidateMatrixCli([
      "--cases",
      casesFile,
      "--max-cases",
      "0",
      "--json",
    ]);
    expect(result.exitCode).toBe(1);

    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("error", "Invalid --max-cases value");
  });

  test("writes manual empirical capture csv via --out-capture-csv", async () => {
    const capturePath = join(exportsDir, "matrix_capture_template.csv");
    rmSync(capturePath, { force: true });

    const result = await runValidateMatrixCli([
      "--cases",
      casesFile,
      "--out-capture-csv",
      capturePath,
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    expect(existsSync(capturePath)).toBe(true);

    const csv = readFileSync(capturePath, "utf8").trim();
    const lines = csv.split("\n");
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain("case_id,status,duration_ms,score_total,grade,confidence_value,confidence_label");
    expect(lines[0]).toContain("upload_account,uploaded_at,downloaded_at,post_url,grid_view_ok,post_view_ok");
    expect(lines[1]).toContain("matrix-basic-reliable-feed-portrait");
    expect(lines[2]).toContain("matrix-basic-reliable-reel-video");
  });

  test("appends capture rows via --append-capture-csv without duplicating header", async () => {
    const capturePath = join(exportsDir, "matrix_capture_append.csv");
    rmSync(capturePath, { force: true });

    const first = await runValidateMatrixCli([
      "--cases",
      casesFile,
      "--out-capture-csv",
      capturePath,
      "--json",
    ]);
    expect(first.exitCode).toBe(0);

    const second = await runValidateMatrixCli([
      "--cases",
      casesFile,
      "--max-cases",
      "1",
      "--out-capture-csv",
      capturePath,
      "--append-capture-csv",
      "--json",
    ]);
    expect(second.exitCode).toBe(0);

    const csv = readFileSync(capturePath, "utf8").trim();
    const lines = csv.split("\n");
    expect(lines.length).toBe(4);
    expect(lines.filter((line) => line.startsWith("case_id,")).length).toBe(1);
    expect(lines[3]).toContain("matrix-basic-reliable-feed-portrait");
  });

  test("returns non-zero when --append-capture-csv is set without --out-capture-csv", async () => {
    const result = await runValidateMatrixCli([
      "--cases",
      casesFile,
      "--append-capture-csv",
      "--json",
    ]);
    expect(result.exitCode).toBe(1);

    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("error", "Missing required args: --out-capture-csv for --append-capture-csv");
  });
});
