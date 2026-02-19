import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseJsonStdout } from "../../helpers/cli";

type Case = { id: string; args: string[] };

const fixturesDir = import.meta.dir;
const repoRoot = join(fixturesDir, "..", "..", "..");
const resolvedRepoRoot = resolve(repoRoot);
const snapshotDir = join(fixturesDir, "snapshots", "report_export");
mkdirSync(snapshotDir, { recursive: true });

const cases = JSON.parse(readFileSync(join(fixturesDir, "report_export_cases.json"), "utf8")) as Case[];

function normalizePath(pathValue: string): string {
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
  const outIndex = testCase.args.findIndex((arg) => arg === "--out");
  if (outIndex >= 0) {
    const outputPath = testCase.args[outIndex + 1];
    if (outputPath && !isAbsolute(outputPath)) {
      const resolvedOutput = resolve(repoRoot, outputPath);
      if (resolvedOutput.startsWith(`${resolvedRepoRoot}${sep}`) || resolvedOutput === resolvedRepoRoot) {
        rmSync(resolvedOutput, { force: true });
      }
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

  const payload = parseJsonStdout(proc.stdout.toString(), testCase.id) as {
    input_analyze?: { input?: { path?: string } };
    output_analyze?: { input?: { path?: string } };
    export?: { input_path?: string; output_path?: string };
  };
  if (typeof payload.input_analyze?.input?.path === "string") {
    payload.input_analyze.input.path = normalizePath(payload.input_analyze.input.path);
  }
  if (typeof payload.output_analyze?.input?.path === "string") {
    payload.output_analyze.input.path = normalizePath(payload.output_analyze.input.path);
  }
  if (typeof payload.export?.input_path === "string") {
    payload.export.input_path = normalizePath(payload.export.input_path);
  }
  if (typeof payload.export?.output_path === "string") {
    payload.export.output_path = normalizePath(payload.export.output_path);
  }

  writeFileSync(join(snapshotDir, `${testCase.id}.json`), `${JSON.stringify(payload)}\n`, "utf8");
}

console.log(`generated ${cases.length} report-export snapshots`);
