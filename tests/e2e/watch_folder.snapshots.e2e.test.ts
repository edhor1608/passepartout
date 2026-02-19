import { describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { runWatchFolderCli } from "../helpers/cli";

type E2eCase = {
  id: string;
  input_files: string[];
  args: string[];
};

const fixtureDir = join(import.meta.dir, "..", "fixtures", "e2e");
const imageDir = join(import.meta.dir, "..", "fixtures", "images");
const snapshotDir = join(fixtureDir, "snapshots", "watch_folder");
const workRoot = join(import.meta.dir, "..", "fixtures", "watch_e2e");
const cases = JSON.parse(readFileSync(join(fixtureDir, "watch_folder_cases.json"), "utf8")) as E2eCase[];

describe("watch-folder e2e snapshots", () => {
  for (const scenario of cases) {
    test(scenario.id, async () => {
      rmSync(workRoot, { recursive: true, force: true });
      const inputDir = join(workRoot, "input");
      const outputDir = join(workRoot, "output");
      mkdirSync(inputDir, { recursive: true });
      mkdirSync(outputDir, { recursive: true });

      for (const file of scenario.input_files) {
        copyFileSync(join(imageDir, file), join(inputDir, file));
      }

      const result = await runWatchFolderCli([
        "--in",
        inputDir,
        "--out",
        outputDir,
        ...scenario.args,
      ]);
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
