import { join } from "node:path";

const dir = import.meta.dir;

const jobs = [
  {
    out: join(dir, "portrait_video_360x640.mp4"),
    args: [
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=360x640:rate=30",
      "-t",
      "1",
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      "-movflags",
      "+faststart",
    ],
  },
  {
    out: join(dir, "landscape_video_640x360.mov"),
    args: [
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=640x360:rate=24",
      "-t",
      "1",
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
    ],
  },
];

for (const job of jobs) {
  const proc = Bun.spawnSync({
    cmd: ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", ...job.args, job.out],
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    throw new Error(`video fixture generation failed for ${job.out}: ${proc.stderr.toString()}`);
  }
}

console.log(`generated ${jobs.length} video fixtures`);
