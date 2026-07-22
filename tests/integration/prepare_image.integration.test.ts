import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPrepareImageCli } from "../helpers/cli";

const outDir = mkdtempSync(join(tmpdir(), "passepartout-prepare-image-"));
const inputDir = mkdtempSync(join(tmpdir(), "passepartout-prepare-image-input-"));
setDefaultTimeout(30_000);

type ProbeResult = {
  codec_name: string;
  height: number;
  width: number;
};

function runTool(cmd: string[]): { exitCode: number; stdout: Uint8Array; stderr: string } {
  const proc = Bun.spawnSync({ cmd, stderr: "pipe", stdout: "pipe" });
  return {
    exitCode: proc.exitCode,
    stderr: proc.stderr.toString(),
    stdout: proc.stdout,
  };
}

function createFixture(path: string, size: string, color: string): void {
  const result = runTool([
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `color=c=${color}:s=${size}`,
    "-frames:v",
    "1",
    path,
  ]);

  if (result.exitCode !== 0) {
    throw new Error(result.stderr);
  }
}

function probeImage(path: string): ProbeResult {
  const result = runTool([
    "ffprobe",
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name,width,height",
    "-of",
    "json",
    path,
  ]);

  if (result.exitCode !== 0) {
    throw new Error(result.stderr);
  }

  const payload = JSON.parse(Buffer.from(result.stdout).toString("utf8")) as {
    streams?: ProbeResult[];
  };
  const stream = payload.streams?.[0];
  if (!stream) {
    throw new Error("ffprobe returned no image stream");
  }

  return stream;
}

function insertExifOrientation(inputPath: string, outputPath: string, orientation: number): void {
  const input = readFileSync(inputPath);
  if (input[0] !== 0xff || input[1] !== 0xd8) {
    throw new Error("Expected JPEG input");
  }

  const payload = Buffer.from([
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00,
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08,
    0x00,
    0x01,
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    orientation,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
  ]);
  const segment = Buffer.alloc(4 + payload.length);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment.writeUInt16BE(payload.length + 2, 2);
  payload.copy(segment, 4);

  writeFileSync(outputPath, Buffer.concat([input.subarray(0, 2), segment, input.subarray(2)]));
}

function hasExifSegment(path: string): boolean {
  return readFileSync(path).includes(Buffer.from("Exif\0\0", "ascii"));
}

function readPixel(path: string, x: number, y: number): [number, number, number] {
  const result = runTool([
    "ffmpeg",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    path,
    "-vf",
    `format=rgb24,crop=1:1:${x}:${y}`,
    "-f",
    "rawvideo",
    "-",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(result.stderr);
  }

  const [r, g, b] = result.stdout;
  if (r === undefined || g === undefined || b === undefined) {
    throw new Error("ffmpeg returned no pixel data");
  }

  return [r, g, b];
}

describe("prepare-image cli", () => {
  test("prints minimal help", async () => {
    const result = await runPrepareImageCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      "Usage: bun run prepare-image <input> --out <file-path-or-directory> [--border-px <integer>]\n",
    );
    expect(result.stderr).toBe("");
  });

  test("exports a PNG as a JPEG and prints the actual output path", async () => {
    const input = join(inputDir, "landscape.png");
    createFixture(input, "48x32", "red");
    const requestedOut = join(outDir, "photo.png");
    const result = await runPrepareImageCli([input, "--out", requestedOut, "--border-px", "0"]);

    const actualOut = join(outDir, "photo.jpg");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(`${actualOut}\n`);
    expect(result.stderr).toBe("");
    expect(existsSync(actualOut)).toBe(true);
    expect(probeImage(actualOut)).toMatchObject({ codec_name: "mjpeg", height: 32, width: 48 });
  });

  test("exports supported images from a directory into an output directory", async () => {
    const batchInputDir = mkdtempSync(join(inputDir, "batch-"));
    const batchOutDir = join(outDir, "batch-output");
    const firstInput = join(batchInputDir, "b-landscape.png");
    const secondInput = join(batchInputDir, "a-portrait.jpg");
    mkdirSync(join(batchInputDir, "nested"));
    createFixture(firstInput, "48x32", "red");
    createFixture(secondInput, "30x40", "blue");
    writeFileSync(join(batchInputDir, "notes.txt"), "skip");

    const result = await runPrepareImageCli([
      batchInputDir,
      "--out",
      batchOutDir,
      "--border-px",
      "0",
    ]);

    const firstOut = join(batchOutDir, "a-portrait.jpg");
    const secondOut = join(batchOutDir, "b-landscape.jpg");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(`${firstOut}\n${secondOut}\n`);
    expect(result.stderr).toBe("");
    expect(probeImage(firstOut)).toMatchObject({ codec_name: "mjpeg", height: 40, width: 30 });
    expect(probeImage(secondOut)).toMatchObject({ codec_name: "mjpeg", height: 32, width: 48 });
  });

  test("uses 57px as the default border on full-size landscape exports", async () => {
    const input = join(inputDir, "default-border.png");
    createFixture(input, "2160x1440", "red");

    const result = await runPrepareImageCli([input, "--out", join(outDir, "default-border")]);

    expect(result.exitCode).toBe(0);
    expect(readPixel(result.stdout.trim(), 28, 720)).toEqual([255, 255, 255]);
    expect(readPixel(result.stdout.trim(), 57, 720)).not.toEqual([255, 255, 255]);
  });

  test("exports JPEG and TIFF inputs", async () => {
    const jpegInput = join(inputDir, "source.jpg");
    const tiffInput = join(inputDir, "source.tiff");
    createFixture(jpegInput, "60x40", "blue");
    createFixture(tiffInput, "48x64", "green");

    const jpegResult = await runPrepareImageCli([
      jpegInput,
      "--out",
      join(outDir, "from-jpeg"),
      "--border-px",
      "0",
    ]);
    const tiffResult = await runPrepareImageCli([
      tiffInput,
      "--out",
      join(outDir, "from-tiff"),
      "--border-px",
      "0",
    ]);

    expect(jpegResult.exitCode).toBe(0);
    expect(tiffResult.exitCode).toBe(0);
    expect(probeImage(jpegResult.stdout.trim())).toMatchObject({
      codec_name: "mjpeg",
      height: 40,
      width: 60,
    });
    expect(probeImage(tiffResult.stdout.trim())).toMatchObject({
      codec_name: "mjpeg",
      height: 64,
      width: 48,
    });
  });

  test("suffixes existing outputs", async () => {
    const input = join(inputDir, "suffix.png");
    const existingOut = join(outDir, "suffix.jpg");
    createFixture(input, "48x32", "red");
    writeFileSync(existingOut, "");

    const result = await runPrepareImageCli([input, "--out", existingOut, "--border-px", "0"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(`${join(outDir, "suffix-1.jpg")}\n`);
  });

  test("composites transparent pixels onto white", async () => {
    const input = join(inputDir, "transparent.png");
    const result = runTool([
      "ffmpeg",
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=white@0.0:s=20x20,format=rgba",
      "-frames:v",
      "1",
      input,
    ]);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }

    const exportResult = await runPrepareImageCli([
      input,
      "--out",
      join(outDir, "transparent"),
      "--border-px",
      "0",
    ]);

    expect(exportResult.exitCode).toBe(0);
    const [r, g, b] = readPixel(exportResult.stdout.trim(), 10, 10);
    expect(r).toBeGreaterThanOrEqual(245);
    expect(g).toBeGreaterThanOrEqual(245);
    expect(b).toBeGreaterThanOrEqual(245);
  });

  test("applies EXIF orientation visually before choosing the output ratio", async () => {
    const rawInput = join(inputDir, "raw-orientation.jpg");
    const orientedInput = join(inputDir, "oriented.jpg");
    createFixture(rawInput, "40x60", "blue");
    insertExifOrientation(rawInput, orientedInput, 6);

    const result = await runPrepareImageCli([
      orientedInput,
      "--out",
      join(outDir, "oriented"),
      "--border-px",
      "0",
    ]);

    expect(result.exitCode).toBe(0);
    expect(probeImage(result.stdout.trim())).toMatchObject({ height: 40, width: 60 });
  });

  test("strips input metadata from the output", async () => {
    const rawInput = join(inputDir, "raw-metadata.jpg");
    const input = join(inputDir, "metadata.jpg");
    createFixture(rawInput, "48x32", "red");
    insertExifOrientation(rawInput, input, 1);

    const result = await runPrepareImageCli([
      input,
      "--out",
      join(outDir, "metadata"),
      "--border-px",
      "0",
    ]);

    expect(result.exitCode).toBe(0);
    expect(hasExifSegment(input)).toBe(true);
    expect(hasExifSegment(result.stdout.trim())).toBe(false);
  });

  test("rejects invalid border values and unknown flags", async () => {
    const input = join(inputDir, "invalid.png");
    createFixture(input, "48x32", "red");

    const badBorder = await runPrepareImageCli([
      input,
      "--out",
      join(outDir, "bad-border"),
      "--border-px",
      "1.5",
    ]);
    const badFlag = await runPrepareImageCli([input, "--out", join(outDir, "bad-flag"), "--json"]);

    expect(badBorder.exitCode).not.toBe(0);
    expect(badBorder.stderr).toContain("Invalid --border-px value");
    expect(badFlag.exitCode).not.toBe(0);
    expect(badFlag.stderr).toContain("Unknown option: --json");
  });
});
