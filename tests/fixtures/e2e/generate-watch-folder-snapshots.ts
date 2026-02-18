import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type E2eCase = {
  id: string;
  input_files: string[];
  args: string[];
};

const fixturesDir = import.meta.dir;
const repoRoot = join(fixturesDir, "..", "..", "..");
const imageDir = join(fixturesDir, "..", "images");
const snapshotDir = join(fixturesDir, "snapshots", "watch_folder");
const workRoot = join(fixturesDir, "..", "watch_e2e");
mkdirSync(snapshotDir, { recursive: true });

const cases = JSON.parse(readFileSync(join(fixturesDir, "watch_folder_cases.json"), "utf8")) as E2eCase[];

function normalizeSnapshotPaths(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replaceAll(repoRoot, "<repo_root>");
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeSnapshotPaths(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeSnapshotPaths(entry)]),
    );
  }
  return value;
}

for (const testCase of cases) {
  rmSync(workRoot, { recursive: true, force: true });
  const inputDir = join(workRoot, "input");
  const outputDir = join(workRoot, "output");
  mkdirSync(inputDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  for (const file of testCase.input_files) {
    copyFileSync(join(imageDir, file), join(inputDir, file));
  }

  const proc = Bun.spawnSync({
    cmd: ["bun", "run", "watch-folder", "--in", inputDir, "--out", outputDir, ...testCase.args],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    throw new Error(`failed for ${testCase.id}: ${proc.stderr.toString()}`);
  }

  const lines = proc.stdout
    .toString()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const payload = lines[lines.length - 1];
  if (!payload?.startsWith("{")) {
    throw new Error(`no json payload for ${testCase.id}`);
  }
  const normalized = normalizeSnapshotPaths(JSON.parse(payload));

  writeFileSync(join(snapshotDir, `${testCase.id}.json`), `${JSON.stringify(normalized)}\n`, "utf8");
}

console.log(`generated ${cases.length} watch-folder snapshots`);
