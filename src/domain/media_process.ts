export type MediaProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

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
  return runMediaProcess(["ffmpeg", ...args]);
}

export function runFfprobe(args: string[]): MediaProcessResult {
  return runMediaProcess(["ffprobe", ...args]);
}
