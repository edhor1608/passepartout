import { resolve } from "node:path";

export type CliRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

const REPO_ROOT = resolve(import.meta.dir, "..", "..");

async function runCli(
  command:
    | "recommend"
    | "analyze"
    | "overlay"
    | "grid-preview"
    | "watch-folder"
    | "export-image"
    | "export-video"
    | "report"
    | "report-export"
    | "benchmark",
  args: string[],
): Promise<CliRunResult> {
  const proc = Bun.spawn({
    cmd: ["bun", "run", command, ...args],
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { exitCode, stdout, stderr };
}

export async function runRecommendCli(args: string[]): Promise<CliRunResult> {
  return runCli("recommend", args);
}

export async function runAnalyzeCli(args: string[]): Promise<CliRunResult> {
  return runCli("analyze", args);
}

export async function runOverlayCli(args: string[]): Promise<CliRunResult> {
  return runCli("overlay", args);
}

export async function runGridPreviewCli(args: string[]): Promise<CliRunResult> {
  return runCli("grid-preview", args);
}

export async function runWatchFolderCli(args: string[]): Promise<CliRunResult> {
  return runCli("watch-folder", args);
}

export async function runExportImageCli(args: string[]): Promise<CliRunResult> {
  return runCli("export-image", args);
}

export async function runExportVideoCli(args: string[]): Promise<CliRunResult> {
  return runCli("export-video", args);
}

export async function runReportCli(args: string[]): Promise<CliRunResult> {
  return runCli("report", args);
}

export async function runReportExportCli(args: string[]): Promise<CliRunResult> {
  return runCli("report-export", args);
}

export async function runBenchmarkCli(args: string[]): Promise<CliRunResult> {
  return runCli("benchmark", args);
}

export function parseJsonStdout(stdout: string): Record<string, unknown> {
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const last = lines[lines.length - 1];
  if (!last || !last.startsWith("{")) {
    throw new Error(`No JSON payload in stdout: ${stdout}`);
  }

  return JSON.parse(last) as Record<string, unknown>;
}
