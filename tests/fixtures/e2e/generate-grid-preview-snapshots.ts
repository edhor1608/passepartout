import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type E2eCase = {
  id: string;
  args: string[];
};

const fixturesDir = import.meta.dir;
const repoRoot = join(fixturesDir, "..", "..", "..");
const snapshotDir = join(fixturesDir, "snapshots", "grid_preview");
mkdirSync(snapshotDir, { recursive: true });

const cases = JSON.parse(readFileSync(join(fixturesDir, "grid_preview_cases.json"), "utf8")) as E2eCase[];

for (const testCase of cases) {
  const proc = Bun.spawnSync({
    cmd: ["bun", "run", "grid-preview", ...testCase.args],
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

  writeFileSync(join(snapshotDir, `${testCase.id}.json`), `${payload}\n`, "utf8");
}

console.log(`generated ${cases.length} grid-preview snapshots`);
