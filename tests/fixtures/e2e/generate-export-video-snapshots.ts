import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseJsonStdout } from "../../helpers/cli";

type ExportCase = {
  id: string;
  args: string[];
};

const fixturesDir = import.meta.dir;
const repoRoot = join(fixturesDir, "..", "..", "..");
const snapshotDir = join(fixturesDir, "snapshots", "export_video");
mkdirSync(snapshotDir, { recursive: true });

const cases = JSON.parse(readFileSync(join(fixturesDir, "export_video_cases.json"), "utf8")) as ExportCase[];

for (const testCase of cases) {
  const outIndex = testCase.args.findIndex((arg) => arg === "--out");
  if (outIndex >= 0) {
    const outputPath = testCase.args[outIndex + 1];
    if (!outputPath) {
      throw new Error(`test case ${testCase.id} has --out without a value`);
    }
    rmSync(join(repoRoot, outputPath), { force: true });
  }

  const proc = Bun.spawnSync({
    cmd: ["bun", "run", "export-video", ...testCase.args],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 60_000,
  });

  if (proc.exitCode !== 0) {
    throw new Error(`failed for ${testCase.id}: ${proc.stderr.toString()}`);
  }

  const payload = parseJsonStdout(proc.stdout.toString(), testCase.id) as {
    input_path?: string;
    output_path?: string;
  };
  if (payload.input_path?.startsWith("/")) {
    payload.input_path = relative(repoRoot, payload.input_path);
  }
  if (payload.output_path?.startsWith("/")) {
    payload.output_path = relative(repoRoot, payload.output_path);
  }

  writeFileSync(join(snapshotDir, `${testCase.id}.json`), `${JSON.stringify(payload)}\n`, "utf8");
}

console.log(`generated ${cases.length} export-video snapshots`);
