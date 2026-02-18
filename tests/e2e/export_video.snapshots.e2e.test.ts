import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJsonStdout, runExportVideoCli } from "../helpers/cli";

type ExportCase = {
  id: string;
  args: string[];
};

const fixtureDir = join(import.meta.dir, "..", "fixtures", "e2e");
const snapshotDir = join(fixtureDir, "snapshots", "export_video");
const cases = JSON.parse(readFileSync(join(fixtureDir, "export_video_cases.json"), "utf8")) as ExportCase[];

function normalizeExportVideoPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const normalized = structuredClone(payload) as { input_path?: string; output_path?: string };
  if (typeof normalized.input_path === "string" && normalized.input_path.startsWith("/")) {
    normalized.input_path = normalized.input_path.replace(/^.*tests\/fixtures\//, "tests/fixtures/");
  }
  if (typeof normalized.output_path === "string" && normalized.output_path.startsWith("/")) {
    normalized.output_path = normalized.output_path.replace(/^.*tests\/fixtures\//, "tests/fixtures/");
  }
  return normalized as Record<string, unknown>;
}

describe("export-video e2e snapshots", () => {
  for (const scenario of cases) {
    test(scenario.id, async () => {
      const result = await runExportVideoCli(scenario.args);
      expect(result.exitCode).toBe(0);
      const expected = normalizeExportVideoPayload(
        JSON.parse(readFileSync(join(snapshotDir, `${scenario.id}.json`), "utf8")) as Record<string, unknown>,
      );
      const actual = normalizeExportVideoPayload(parseJsonStdout(result.stdout, scenario.id));
      expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    });
  }
});
