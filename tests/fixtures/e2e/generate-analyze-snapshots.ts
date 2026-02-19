import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { parseJsonStdout } from "../../helpers/cli";

type AnalyzeCase = {
  id: string;
  args: string[];
};

const fixturesDir = import.meta.dir;
const repoRoot = join(fixturesDir, "..", "..", "..");
const snapshotDir = join(fixturesDir, "snapshots", "analyze");
mkdirSync(snapshotDir, { recursive: true });

function normalizeSnapshotPath(pathValue: string): string {
  const normalizedSlashes = pathValue.replaceAll("\\", "/");
  if (/^[A-Za-z]:\//.test(normalizedSlashes)) {
    return normalizedSlashes.replace(/^.*tests\/fixtures\//, "tests/fixtures/");
  }
  if (isAbsolute(pathValue)) {
    return relative(repoRoot, pathValue).replaceAll("\\", "/");
  }
  return normalizedSlashes;
}

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
  if (typeof payload.input?.path === "string") {
    payload.input.path = normalizeSnapshotPath(payload.input.path);
  }

  writeFileSync(join(snapshotDir, `${testCase.id}.json`), `${JSON.stringify(payload)}\n`, "utf8");
}

console.log(`generated ${cases.length} analyze snapshots`);
