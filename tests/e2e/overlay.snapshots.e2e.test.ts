import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJsonStdout, runOverlayCli } from "../helpers/cli";

type E2eCase = {
  id: string;
  args: string[];
};

const fixtureDir = join(import.meta.dir, "..", "fixtures", "e2e");
const snapshotDir = join(fixtureDir, "snapshots", "overlay");
const cases = JSON.parse(readFileSync(join(fixtureDir, "overlay_cases.json"), "utf8")) as E2eCase[];

describe("overlay e2e snapshots", () => {
  for (const scenario of cases) {
    test(scenario.id, async () => {
      const result = await runOverlayCli(scenario.args);
      expect(result.exitCode).toBe(0);

      const expected = JSON.parse(
        readFileSync(join(snapshotDir, `${scenario.id}.json`), "utf8"),
      ) as Record<string, unknown>;
      const actual = parseJsonStdout(result.stdout, scenario.id);
      expect(actual).toEqual(expected);
    });
  }
});
