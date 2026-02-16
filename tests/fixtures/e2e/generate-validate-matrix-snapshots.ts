import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stableStringify } from "../../../src/domain/recommend";

type Case = { id: string; args: string[]; expected_exit_code?: number };

const fixturesDir = import.meta.dir;
const repoRoot = join(fixturesDir, "..", "..", "..");
const snapshotDir = join(fixturesDir, "snapshots", "validate_matrix");
mkdirSync(snapshotDir, { recursive: true });

const cases = JSON.parse(readFileSync(join(fixturesDir, "validate_matrix_cases.json"), "utf8")) as Case[];

function normalizePayload(raw: string): string {
  const parsed = JSON.parse(raw) as {
    duration_ms?: number;
    results?: Array<{ duration_ms?: number }>;
  };
  parsed.duration_ms = 0;
  if (Array.isArray(parsed.results)) {
    for (const row of parsed.results) {
      row.duration_ms = 0;
    }
  }
  return stableStringify(parsed);
}

for (const testCase of cases) {
  const proc = Bun.spawnSync({
    cmd: ["bun", "run", "validate-matrix", ...testCase.args],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  const expectedExit = testCase.expected_exit_code ?? 0;
  if (proc.exitCode !== expectedExit) {
    throw new Error(
      `failed for ${testCase.id}: expected exit ${expectedExit}, got ${proc.exitCode}: ${proc.stderr.toString()}`,
    );
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

  writeFileSync(join(snapshotDir, `${testCase.id}.json`), `${normalizePayload(payload)}\n`, "utf8");
}

console.log(`generated ${cases.length} validate-matrix snapshots`);
