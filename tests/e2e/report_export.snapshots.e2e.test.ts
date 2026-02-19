import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { parseJsonStdout, runReportExportCli } from "../helpers/cli";

type Case = { id: string; args: string[] };

const fixtureDir = join(import.meta.dir, "..", "fixtures", "e2e");
const snapshotDir = join(fixtureDir, "snapshots", "report_export");
const repoRoot = join(import.meta.dir, "..", "..");
const cases = JSON.parse(readFileSync(join(fixtureDir, "report_export_cases.json"), "utf8")) as Case[];

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

function normalizeReportExportPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const normalized = structuredClone(payload) as {
    input_analyze?: { input?: { path?: string } };
    output_analyze?: { input?: { path?: string } };
    export?: { input_path?: string; output_path?: string };
  };

  if (typeof normalized.input_analyze?.input?.path === "string") {
    normalized.input_analyze.input.path = normalizePath(normalized.input_analyze.input.path);
  }
  if (typeof normalized.output_analyze?.input?.path === "string") {
    normalized.output_analyze.input.path = normalizePath(normalized.output_analyze.input.path);
  }
  if (typeof normalized.export?.input_path === "string") {
    normalized.export.input_path = normalizePath(normalized.export.input_path);
  }
  if (typeof normalized.export?.output_path === "string") {
    normalized.export.output_path = normalizePath(normalized.export.output_path);
  }

  return normalized as Record<string, unknown>;
}

describe("report-export e2e snapshots", () => {
  for (const scenario of cases) {
    test(scenario.id, async () => {
      const result = await runReportExportCli(scenario.args);
      expect(result.exitCode).toBe(0);

      const expected = normalizeReportExportPayload(
        JSON.parse(readFileSync(join(snapshotDir, `${scenario.id}.json`), "utf8")) as Record<string, unknown>,
      );
      const actual = normalizeReportExportPayload(parseJsonStdout(result.stdout, scenario.id));
      expect(actual).toEqual(expected);
    });
  }
});
