import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { E2eCase } from "./e2e_types";

const fixturesDir = import.meta.dir;
const repoRoot = join(fixturesDir, "..", "..", "..");
const snapshotDir = join(fixturesDir, "snapshots", "overlay");
mkdirSync(snapshotDir, { recursive: true });

const cases = JSON.parse(readFileSync(join(fixturesDir, "overlay_cases.json"), "utf8")) as E2eCase[];

for (const testCase of cases) {
  const proc = Bun.spawnSync({
    cmd: ["bun", "run", "overlay", ...testCase.args],
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

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid json payload for ${testCase.id}: ${message}`);
  }

  writeFileSync(join(snapshotDir, `${testCase.id}.json`), `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

console.log(`generated ${cases.length} overlay snapshots`);
