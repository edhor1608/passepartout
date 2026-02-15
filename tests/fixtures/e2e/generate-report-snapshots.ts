import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";

type ReportCase = {
  id: string;
  args: string[];
};

const fixturesDir = import.meta.dir;
const repoRoot = join(fixturesDir, "..", "..", "..");
const snapshotDir = join(fixturesDir, "snapshots", "report");
mkdirSync(snapshotDir, { recursive: true });

const cases = JSON.parse(readFileSync(join(fixturesDir, "report_cases.json"), "utf8")) as ReportCase[];

function normalizeReportPath(pathValue: string): string {
  const normalizedSlashes = pathValue.replaceAll("\\", "/");
  if (/^[A-Za-z]:\//.test(normalizedSlashes)) {
    return normalizedSlashes.replace(/^.*tests\/fixtures\//, "tests/fixtures/");
  }
  if (isAbsolute(pathValue)) {
    return relative(repoRoot, pathValue).replaceAll("\\", "/");
  }
  return normalizedSlashes;
}

for (const testCase of cases) {
  const proc = Bun.spawnSync({
    cmd: ["bun", "run", "report", ...testCase.args],
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
  if (!payload) {
    throw new Error(`no json payload for ${testCase.id}`);
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid json payload for ${testCase.id}: ${message}; payload=${payload}`);
  }

  const analyze = parsed.analyze as { input?: { path?: string } } | undefined;
  if (typeof analyze?.input?.path === "string") {
    analyze.input.path = normalizeReportPath(analyze.input.path);
  }

  writeFileSync(join(snapshotDir, `${testCase.id}.json`), `${JSON.stringify(parsed)}\n`, "utf8");
}

console.log(`generated ${cases.length} report snapshots`);
