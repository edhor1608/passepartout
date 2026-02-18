import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseJsonStdout } from "../../helpers/cli";

type E2eCase = {
  id: string;
  args: string[];
};

const fixturesDir = import.meta.dir;
const repoRoot = join(fixturesDir, "..", "..", "..");
const snapshotDir = join(fixturesDir, "snapshots");
mkdirSync(snapshotDir, { recursive: true });

const cases = JSON.parse(readFileSync(join(fixturesDir, "recommend_cases.json"), "utf8")) as E2eCase[];

for (const testCase of cases) {
  const proc = Bun.spawnSync({
    cmd: ["bun", "run", "recommend", ...testCase.args],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    throw new Error(`failed for ${testCase.id}: ${proc.stderr.toString()}`);
  }

  const payload = parseJsonStdout(proc.stdout.toString(), testCase.id);
  writeFileSync(join(snapshotDir, `${testCase.id}.json`), `${JSON.stringify(payload)}\n`, "utf8");
}

console.log(`generated ${cases.length} e2e snapshots`);
