import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runReportExportCli } from "../helpers/cli";

type Case = { id: string; args: string[] };

const fixtureDir = join(import.meta.dir, "..", "fixtures", "e2e");
const snapshotDir = join(fixtureDir, "snapshots", "report_export");
const cases = JSON.parse(readFileSync(join(fixtureDir, "report_export_cases.json"), "utf8")) as Case[];

describe("report-export e2e snapshots", () => {
  for (const scenario of cases) {
    test(scenario.id, async () => {
      const result = await runReportExportCli(scenario.args);
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
