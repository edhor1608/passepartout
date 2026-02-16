import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stableStringify } from "../../src/domain/recommend";
import { runValidateMatrixCli } from "../helpers/cli";

type Case = { id: string; args: string[]; expected_exit_code?: number };

const fixtureDir = join(import.meta.dir, "..", "fixtures", "e2e");
const snapshotDir = join(fixtureDir, "snapshots", "validate_matrix");
const cases = JSON.parse(readFileSync(join(fixtureDir, "validate_matrix_cases.json"), "utf8")) as Case[];

function normalizePayload(raw: string): string {
  const parsed = JSON.parse(raw) as Record<string, unknown> & {
    results?: Array<Record<string, unknown>>;
  };
  if (typeof parsed.duration_ms === "number") {
    parsed.duration_ms = 0;
  }
  if (Array.isArray(parsed.results)) {
    for (const row of parsed.results) {
      if (typeof row.duration_ms === "number") {
        row.duration_ms = 0;
      }
    }
  }
  return stableStringify(parsed);
}

describe("validate-matrix e2e snapshots", () => {
  for (const scenario of cases) {
    test(scenario.id, async () => {
      const result = await runValidateMatrixCli(scenario.args);
      expect(result.exitCode).toBe(scenario.expected_exit_code ?? 0);

      const expected = readFileSync(join(snapshotDir, `${scenario.id}.json`), "utf8").trim();
      const actual = result.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .at(-1);

      expect(normalizePayload(actual ?? "")).toBe(expected);
    });
  }
});
