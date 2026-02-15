import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { parseJsonStdout, runReportCli } from "../helpers/cli";

type ReportCase = {
  id: string;
  args: string[];
};

const fixtureDir = join(import.meta.dir, "..", "fixtures", "e2e");
const snapshotDir = join(fixtureDir, "snapshots", "report");
const repoRoot = join(import.meta.dir, "..", "..");
const cases = JSON.parse(readFileSync(join(fixtureDir, "report_cases.json"), "utf8")) as ReportCase[];

function normalizeReportPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const normalized = structuredClone(payload) as { analyze?: { input?: { path?: string } } };
  const pathValue = normalized.analyze?.input?.path;
  if (typeof pathValue === "string") {
    const normalizedSlashes = pathValue.replaceAll("\\", "/");
    if (/^[A-Za-z]:\//.test(normalizedSlashes)) {
      normalized.analyze!.input!.path = normalizedSlashes.replace(/^.*tests\/fixtures\//, "tests/fixtures/");
    } else if (isAbsolute(pathValue)) {
      normalized.analyze!.input!.path = relative(repoRoot, pathValue).replaceAll("\\", "/");
    } else {
      normalized.analyze!.input!.path = normalizedSlashes;
    }
  }
  return normalized as Record<string, unknown>;
}

describe("report e2e snapshots", () => {
  for (const scenario of cases) {
    test(scenario.id, async () => {
      const result = await runReportCli(scenario.args);
      expect(result.exitCode).toBe(0);

      const expected = normalizeReportPayload(
        JSON.parse(readFileSync(join(snapshotDir, `${scenario.id}.json`), "utf8")) as Record<string, unknown>,
      );
      const actual = normalizeReportPayload(parseJsonStdout(result.stdout, scenario.id));
      expect(actual).toEqual(expected);
    });
  }
});
