import { resolve } from "node:path";
import { runFfmpeg } from "./media_process";

export type ObjectiveMetrics = {
  psnrDb: number | null;
  ssim: number | null;
  note: string | null;
};

function toRounded(value: number): number {
  return Number.parseFloat(value.toFixed(4));
}

function parsePsnrAverage(stderr: string): number | null {
  const matches = Array.from(stderr.matchAll(/average:([0-9.]+|inf)/g));
  const token = matches.at(-1)?.[1];
  if (!token) {
    return null;
  }
  if (token === "inf") {
    return 100;
  }
  const value = Number.parseFloat(token);
  return Number.isFinite(value) ? toRounded(value) : null;
}

function parseSsimAll(stderr: string): number | null {
  const matches = Array.from(stderr.matchAll(/All:([0-9.]+)/g));
  const token = matches.at(-1)?.[1];
  if (!token) {
    return null;
  }
  const value = Number.parseFloat(token);
  if (!Number.isFinite(value)) {
    return null;
  }
  return toRounded(Math.max(0, Math.min(1, value)));
}

export function computeObjectiveMetrics(inputPath: string, outputPath: string): ObjectiveMetrics {
  const inFile = resolve(inputPath);
  const outFile = resolve(outputPath);

  const proc = runFfmpeg([
    "-hide_banner",
    "-loglevel",
    "info",
    "-i",
    inFile,
    "-i",
    outFile,
    "-filter_complex",
    "[0:v][1:v]scale2ref=flags=bicubic[dist][ref];[dist]split[dist_psnr][dist_ssim];[ref]split[ref_psnr][ref_ssim];[dist_psnr][ref_psnr]psnr;[dist_ssim][ref_ssim]ssim",
    "-an",
    "-f",
    "null",
    "-",
  ]);

  if (proc.exitCode !== 0) {
    return {
      psnrDb: null,
      ssim: null,
      note: `objective metrics unavailable: ${proc.stderr.trim()}`,
    };
  }

  const stderr = proc.stderr;
  const psnrDb = parsePsnrAverage(stderr);
  const ssim = parseSsimAll(stderr);

  if (psnrDb === null || ssim === null) {
    return {
      psnrDb,
      ssim,
      note: "objective metrics parse incomplete from ffmpeg output",
    };
  }

  return {
    psnrDb,
    ssim,
    note: null,
  };
}
