import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runRecommendCli } from "../helpers/cli";

type E2eCase = {
  id: string;
  args: string[];
};

const fixtureDir = join(import.meta.dir, "..", "fixtures", "e2e");
const snapshotDir = join(fixtureDir, "snapshots");
const cases = JSON.parse(readFileSync(join(fixtureDir, "recommend_cases.json"), "utf8")) as E2eCase[];

describe("e2e snapshot cases", () => {
  for (const scenario of cases) {
    test(scenario.id, async () => {
      const result = await runRecommendCli(scenario.args);
      expect(result.exitCode).toBe(0);

      const expected = readFileSync(join(snapshotDir, `${scenario.id}.json`), "utf8").trim();
      const actual = result.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .at(-1);

      expect(actual).toBe(expected);
    });
  }
});
