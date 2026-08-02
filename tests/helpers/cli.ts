import { resolve } from "node:path";

export type CliRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

const REPO_ROOT = resolve(import.meta.dir, "..", "..");

export async function runPrepareImageCli(
  args: string[],
  options?: { env?: Record<string, string | undefined> },
): Promise<CliRunResult> {
  const proc = Bun.spawn({
    cmd: [process.execPath, "run", "--silent", "prepare-image", ...args],
    cwd: REPO_ROOT,
    // Spread rather than `env: undefined`: under `exactOptionalPropertyTypes`
    // an explicit undefined is not assignable to an optional property, so the
    // key has to be absent when the caller passes no override.
    ...(options?.env === undefined ? {} : { env: { ...process.env, ...options.env } }),
    stderr: "pipe",
    stdout: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { exitCode, stderr, stdout };
}
