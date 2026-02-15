import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Case = { id: string; args: string[] };

const fixturesDir = import.meta.dir;
const repoRoot = join(fixturesDir, "..", "..", "..");
const snapshotDir = join(fixturesDir, "snapshots", "report_export");
mkdirSync(snapshotDir, { recursive: true });

const cases = JSON.parse(readFileSync(join(fixturesDir, "report_export_cases.json"), "utf8")) as Case[];

for (const testCase of cases) {
  const outIndex = testCase.args.findIndex((arg) => arg === "--out");
  if (outIndex >= 0) {
    const outputPath = testCase.args[outIndex + 1];
    if (outputPath) {
      rmSync(join(repoRoot, outputPath), { force: true });
    }
  }

  const proc = Bun.spawnSync({
    cmd: ["bun", "run", "report-export", ...testCase.args],
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

console.log(`generated ${cases.length} report-export snapshots`);
