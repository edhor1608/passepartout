import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseJsonStdout } from "../../helpers/cli";

type AnalyzeCase = {
  id: string;
  args: string[];
};

const fixturesDir = import.meta.dir;
const repoRoot = join(fixturesDir, "..", "..", "..");
const snapshotDir = join(fixturesDir, "snapshots", "analyze");
mkdirSync(snapshotDir, { recursive: true });

const cases = JSON.parse(readFileSync(join(fixturesDir, "analyze_cases.json"), "utf8")) as AnalyzeCase[];

for (const testCase of cases) {
  const proc = Bun.spawnSync({
    cmd: ["bun", "run", "analyze", ...testCase.args],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    throw new Error(`failed for ${testCase.id}: ${proc.stderr.toString()}`);
  }

  const payload = parseJsonStdout(proc.stdout.toString(), testCase.id) as {
    input?: { path?: string };
  };
  if (payload.input?.path?.startsWith("/")) {
    payload.input.path = relative(repoRoot, payload.input.path);
  }

  writeFileSync(join(snapshotDir, `${testCase.id}.json`), `${JSON.stringify(payload)}\n`, "utf8");
}

console.log(`generated ${cases.length} analyze snapshots`);
