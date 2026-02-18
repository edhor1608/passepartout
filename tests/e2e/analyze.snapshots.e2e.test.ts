import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { parseJsonStdout, runAnalyzeCli } from "../helpers/cli";

type AnalyzeCase = {
  id: string;
  args: string[];
};

const fixtureDir = join(import.meta.dir, "..", "fixtures", "e2e");
const snapshotDir = join(fixtureDir, "snapshots", "analyze");
const repoRoot = join(import.meta.dir, "..", "..");
const cases = JSON.parse(readFileSync(join(fixtureDir, "analyze_cases.json"), "utf8")) as AnalyzeCase[];

function normalizeAnalyzePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const normalized = structuredClone(payload) as { input?: { path?: string } };
  const pathValue = normalized.input?.path;
  if (typeof pathValue === "string") {
    const normalizedSlashes = pathValue.replaceAll("\\", "/");
    if (/^[A-Za-z]:\//.test(normalizedSlashes)) {
      normalized.input!.path = normalizedSlashes.replace(/^.*tests\/fixtures\//, "tests/fixtures/");
    } else if (isAbsolute(pathValue)) {
      normalized.input!.path = relative(repoRoot, pathValue).replaceAll("\\", "/");
    } else {
      normalized.input!.path = normalizedSlashes;
    }
  }
  return normalized as Record<string, unknown>;
}

describe("analyze e2e snapshots", () => {
  for (const scenario of cases) {
    test(scenario.id, async () => {
      const result = await runAnalyzeCli(scenario.args);
      expect(result.exitCode).toBe(0);
      const expected = normalizeAnalyzePayload(
        JSON.parse(readFileSync(join(snapshotDir, `${scenario.id}.json`), "utf8")) as Record<string, unknown>,
      );
      const actual = normalizeAnalyzePayload(parseJsonStdout(result.stdout, scenario.id));
      expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    });
  }
});
