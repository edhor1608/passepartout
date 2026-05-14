import { resolve } from "node:path";

export type CliRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

const REPO_ROOT = resolve(import.meta.dir, "..", "..");

export async function runPrepareImageCli(args: string[]): Promise<CliRunResult> {
  const proc = Bun.spawn({
    cmd: ["bun", "src/cli/prepare_image.ts", ...args],
    cwd: REPO_ROOT,
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
