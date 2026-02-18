import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runGridPreviewCli } from "../helpers/cli";

type E2eCase = {
  id: string;
  args: string[];
};

const fixtureDir = join(import.meta.dir, "..", "fixtures", "e2e");
const snapshotDir = join(fixtureDir, "snapshots", "grid_preview");
const cases = JSON.parse(readFileSync(join(fixtureDir, "grid_preview_cases.json"), "utf8")) as E2eCase[];

describe("grid-preview e2e snapshots", () => {
  for (const scenario of cases) {
    test(scenario.id, async () => {
      const result = await runGridPreviewCli(scenario.args);
      expect(result.exitCode).toBe(0);

      const expected = readFileSync(join(snapshotDir, `${scenario.id}.json`), "utf8").trim();
      const actual = result.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .at(-1);
      if (!actual) {
        throw new Error(
          `Missing JSON stdout for ${scenario.id} (${join(snapshotDir, `${scenario.id}.json`)}). Raw stdout: ${result.stdout}`,
        );
      }

      expect(actual).toBe(expected);
    });
  }
});
