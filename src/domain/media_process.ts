import { createRequire } from "node:module";

export type MediaProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

const require = createRequire(import.meta.url);
const FFMPEG_CMD = Bun.which("ffmpeg") ?? resolveBundledFfmpegPath() ?? "ffmpeg";
const FFPROBE_CMD = Bun.which("ffprobe") ?? resolveBundledFfprobePath() ?? "ffprobe";

function resolveBundledFfmpegPath(): string | undefined {
  try {
    const path = require("ffmpeg-static") as unknown;
    return typeof path === "string" && path.length > 0 ? path : undefined;
  } catch {
    return undefined;
  }
}

function resolveBundledFfprobePath(): string | undefined {
  try {
    const ffprobeStatic = require("ffprobe-static") as { path?: unknown };
    return typeof ffprobeStatic.path === "string" && ffprobeStatic.path.length > 0
      ? ffprobeStatic.path
      : undefined;
  } catch {
    return undefined;
  }
}

function runMediaProcess(cmd: string[]): MediaProcessResult {
  const proc = Bun.spawnSync({
    cmd,
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

export function runFfmpeg(args: string[]): MediaProcessResult {
  return runMediaProcess([FFMPEG_CMD, ...args]);
}

export function runFfprobe(args: string[]): MediaProcessResult {
  return runMediaProcess([FFPROBE_CMD, ...args]);
}
