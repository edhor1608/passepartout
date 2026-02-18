import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJsonStdout, runAnalyzeCli } from "../helpers/cli";

type AnalyzeCase = {
  id: string;
  args: string[];
};

const fixtureDir = join(import.meta.dir, "..", "fixtures", "e2e");
const snapshotDir = join(fixtureDir, "snapshots", "analyze");
const cases = JSON.parse(readFileSync(join(fixtureDir, "analyze_cases.json"), "utf8")) as AnalyzeCase[];

function normalizeAnalyzePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const normalized = structuredClone(payload) as { input?: { path?: string } };
  const path = normalized.input?.path;
  if (typeof path === "string" && path.startsWith("/")) {
    normalized.input.path = path.replace(/^.*tests\/fixtures\//, "tests/fixtures/");
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
