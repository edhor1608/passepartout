import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { parseJsonStdout, runBenchmarkCli } from "../helpers/cli";

type Case = { id: string; args: string[] };

const fixtureDir = join(import.meta.dir, "..", "fixtures", "e2e");
const snapshotDir = join(fixtureDir, "snapshots", "benchmark");
const repoRoot = join(import.meta.dir, "..", "..");
const cases = JSON.parse(readFileSync(join(fixtureDir, "benchmark_cases.json"), "utf8")) as Case[];

function normalizePath(pathValue: string): string {
  const normalizedSlashes = pathValue.replaceAll("\\", "/");
  if (/^[A-Za-z]:\//.test(normalizedSlashes)) {
    return normalizedSlashes.replace(/^.*tests\/fixtures\//, "tests/fixtures/");
  }
  if (isAbsolute(pathValue)) {
    return relative(repoRoot, pathValue).replaceAll("\\", "/");
  }
  return normalizedSlashes;
}

function normalizeBenchmarkPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const normalized = structuredClone(payload) as {
    report_export?: {
      input_analyze?: { input?: { path?: string } };
      output_analyze?: { input?: { path?: string } };
      export?: { input_path?: string; output_path?: string };
    };
  };

  if (typeof normalized.report_export?.input_analyze?.input?.path === "string") {
    normalized.report_export.input_analyze.input.path = normalizePath(
      normalized.report_export.input_analyze.input.path,
    );
  }
  if (typeof normalized.report_export?.output_analyze?.input?.path === "string") {
    normalized.report_export.output_analyze.input.path = normalizePath(
      normalized.report_export.output_analyze.input.path,
    );
  }
  if (typeof normalized.report_export?.export?.input_path === "string") {
    normalized.report_export.export.input_path = normalizePath(normalized.report_export.export.input_path);
  }
  if (typeof normalized.report_export?.export?.output_path === "string") {
    normalized.report_export.export.output_path = normalizePath(normalized.report_export.export.output_path);
  }

  return normalized as Record<string, unknown>;
}

describe("benchmark e2e snapshots", () => {
  for (const scenario of cases) {
    test(scenario.id, async () => {
      const result = await runBenchmarkCli(scenario.args);
      expect(result.exitCode).toBe(0);

      const expected = normalizeBenchmarkPayload(
        JSON.parse(readFileSync(join(snapshotDir, `${scenario.id}.json`), "utf8")) as Record<string, unknown>,
      );
      const actual = normalizeBenchmarkPayload(parseJsonStdout(result.stdout, scenario.id));
      expect(actual).toEqual(expected);
    });
  }
});
