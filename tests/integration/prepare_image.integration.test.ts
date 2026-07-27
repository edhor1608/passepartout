import { describe, expect, setDefaultTimeout, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runPrepareImageCli } from "../helpers/cli";

const outDir = mkdtempSync(join(tmpdir(), "passepartout-prepare-image-"));
const inputDir = mkdtempSync(join(tmpdir(), "passepartout-prepare-image-input-"));
setDefaultTimeout(30_000);

type ProbeResult = {
  codec_name: string;
  height: number;
  pix_fmt: string;
  profile: string;
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

/**
 * Quadrant marker colours, keyed by their position in the *stored* (pre-rotation)
 * frame. Each is far from the others in RGB so lossy JPEG round-tripping cannot
 * make one classify as another.
 */
const QUADRANT_COLORS = {
  bottomLeft: [0x00, 0x00, 0xff],
  bottomRight: [0xff, 0xff, 0x00],
  topLeft: [0xff, 0x00, 0x00],
  topRight: [0x00, 0xff, 0x00],
} as const;

type QuadrantName = keyof typeof QUADRANT_COLORS;

/** Portrait 40x60 JPEG with a distinct solid colour in each 20x30 quadrant. */
function createQuadrantFixture(path: string): void {
  const result = runTool([
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=0xFF0000:s=20x30",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x00FF00:s=20x30",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x0000FF:s=20x30",
    "-f",
    "lavfi",
    "-i",
    "color=c=0xFFFF00:s=20x30",
    "-filter_complex",
    "[0:v][1:v]hstack[top];[2:v][3:v]hstack[bottom];[top][bottom]vstack",
    "-frames:v",
    "1",
    path,
  ]);

  if (result.exitCode !== 0) {
    throw new Error(result.stderr);
  }
}

/** Nearest-marker classification, so JPEG chroma subsampling cannot fail the test. */
function classifyQuadrantColor(pixel: readonly [number, number, number]): QuadrantName {
  let best: QuadrantName = "topLeft";
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [name, reference] of Object.entries(QUADRANT_COLORS) as [
    QuadrantName,
    readonly [number, number, number],
  ][]) {
    const distance =
      (pixel[0] - reference[0]) ** 2 +
      (pixel[1] - reference[1]) ** 2 +
      (pixel[2] - reference[2]) ** 2;
    if (distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }

  return best;
}

/** Which stored quadrant ends up in each displayed corner, per EXIF orientation. */
function readCornerQuadrants(path: string): Record<QuadrantName, QuadrantName> {
  const { height, width } = probeImage(path);
  const inset = 4;
  const right = width - 1 - inset;
  const bottom = height - 1 - inset;

  return {
    bottomLeft: classifyQuadrantColor(readPixel(path, inset, bottom)),
    bottomRight: classifyQuadrantColor(readPixel(path, right, bottom)),
    topLeft: classifyQuadrantColor(readPixel(path, inset, inset)),
    topRight: classifyQuadrantColor(readPixel(path, right, inset)),
  };
}

function createHorizontalPatternFixture(path: string): void {
  const result = runTool([
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=100x200",
    "-f",
    "lavfi",
    "-i",
    "color=c=green:s=200x200",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=100x200",
    "-filter_complex",
    "[0:v][1:v][2:v]hstack=inputs=3",
    "-frames:v",
    "1",
    path,
  ]);

  if (result.exitCode !== 0) {
    throw new Error(result.stderr);
  }
}

function createTaggedDisplayP3Fixture(path: string, size: string, color: string): void {
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
    "-vf",
    "format=rgb24,setparams=range=pc:colorspace=gbr:color_primaries=smpte432:color_trc=iec61966-2-1",
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
    "stream=codec_name,profile,pix_fmt,width,height",
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

function hasExifOrientationTag(path: string): boolean {
  return readFileSync(path).includes(Buffer.from([0x01, 0x12, 0x00, 0x03]));
}

function hasSrgbColorSpaceTag(path: string): boolean {
  return readFileSync(path).includes(
    Buffer.from([0xa0, 0x01, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01]),
  );
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
    expect(probeImage(actualOut)).toMatchObject({
      codec_name: "mjpeg",
      height: 32,
      pix_fmt: "yuvj420p",
      profile: "Baseline",
      width: 48,
    });
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

  test("accepts only supported file inputs", async () => {
    const unsupportedInput = join(inputDir, "unsupported.bmp");
    createFixture(unsupportedInput, "48x32", "red");

    const result = await runPrepareImageCli([
      unsupportedInput,
      "--out",
      join(outDir, "unsupported"),
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Unsupported input format: .bmp; expected PNG, JPEG, or TIFF");
    expect(existsSync(join(outDir, "unsupported.jpg"))).toBe(false);
  });

  test("rolls back a directory run when any supported source fails", async () => {
    const batchInputDir = mkdtempSync(join(inputDir, "rollback-"));
    const batchOutDir = join(outDir, "rollback-output");
    createFixture(join(batchInputDir, "a-valid.png"), "48x32", "red");
    writeFileSync(join(batchInputDir, "b-broken.jpg"), "not a jpeg");

    const result = await runPrepareImageCli([batchInputDir, "--out", batchOutDir]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("ffprobe");
    expect(readdirSync(batchOutDir)).toEqual([]);
  });

  test("suffixes colliding basenames within one directory run", async () => {
    const batchInputDir = mkdtempSync(join(inputDir, "same-basename-"));
    const batchOutDir = join(outDir, "same-basename-output");
    createFixture(join(batchInputDir, "photo.jpg"), "48x32", "red");
    createFixture(join(batchInputDir, "photo.png"), "48x32", "blue");

    const result = await runPrepareImageCli([
      batchInputDir,
      "--out",
      batchOutDir,
      "--border-px",
      "0",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      `${join(batchOutDir, "photo.jpg")}\n${join(batchOutDir, "photo-1.jpg")}\n`,
    );
  });

  test("uses 57px as the default border on full-size landscape exports", async () => {
    const input = join(inputDir, "default-border.png");
    createFixture(input, "2160x1440", "red");

    const result = await runPrepareImageCli([input, "--out", join(outDir, "default-border")]);

    expect(result.exitCode).toBe(0);
    const outputPath = result.stdout.trim();
    expect(readPixel(outputPath, 28, 720)).toEqual([255, 255, 255]);
    expect(readPixel(outputPath, 57, 720)).not.toEqual([255, 255, 255]);
    expect(readPixel(outputPath, 2131, 720)).toEqual([255, 255, 255]);
    expect(readPixel(outputPath, 2102, 720)).not.toEqual([255, 255, 255]);
    expect(readPixel(outputPath, 1080, 28)).toEqual([255, 255, 255]);
    expect(readPixel(outputPath, 1080, 57)).not.toEqual([255, 255, 255]);
    expect(readPixel(outputPath, 1080, 1411)).toEqual([255, 255, 255]);
    expect(readPixel(outputPath, 1080, 1382)).not.toEqual([255, 255, 255]);
  });

  test("shrinks small sources without upscaling and preserves the target ratio", async () => {
    const input = join(inputDir, "small-landscape.png");
    createFixture(input, "1000x600", "red");

    const result = await runPrepareImageCli([
      input,
      "--out",
      join(outDir, "small-landscape"),
      "--border-px",
      "165",
    ]);

    expect(result.exitCode).toBe(0);
    expect(probeImage(result.stdout.trim())).toMatchObject({ height: 778, width: 1167 });
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

  test("allocates colliding outputs atomically across concurrent commands", async () => {
    const input = join(inputDir, "concurrent.png");
    createFixture(input, "48x32", "red");
    const requestedOut = join(outDir, "concurrent");

    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        runPrepareImageCli([input, "--out", requestedOut, "--border-px", "0"]),
      ),
    );

    expect(results.every((result) => result.exitCode === 0)).toBe(true);
    expect(new Set(results.map((result) => result.stdout.trim()))).toEqual(
      new Set([
        join(outDir, "concurrent.jpg"),
        join(outDir, "concurrent-1.jpg"),
        join(outDir, "concurrent-2.jpg"),
        join(outDir, "concurrent-3.jpg"),
      ]),
    );
  });

  test("creates missing output parents", async () => {
    const input = join(inputDir, "parents.png");
    createFixture(input, "48x32", "red");
    const requestedOut = join(outDir, "missing", "parents", "photo.png");

    const result = await runPrepareImageCli([input, "--out", requestedOut, "--border-px", "0"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(`${join(outDir, "missing", "parents", "photo.jpg")}\n`);
  });

  test("uses bundled image-engine adapters when system tools are absent from PATH", async () => {
    const input = join(inputDir, "bundled-fallback.png");
    createFixture(input, "48x32", "red");

    const result = await runPrepareImageCli(
      [input, "--out", join(outDir, "bundled-fallback"), "--border-px", "0"],
      { env: { PATH: dirname(process.execPath) } },
    );

    expect(result.exitCode).toBe(0);
    expect(probeImage(result.stdout.trim())).toMatchObject({ height: 32, width: 48 });
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

  test("uses centered landscape crop through the rendered command interface", async () => {
    const input = join(inputDir, "pattern-landscape.png");
    createHorizontalPatternFixture(input);

    const result = await runPrepareImageCli([
      input,
      "--out",
      join(outDir, "pattern-landscape"),
      "--border-px",
      "30",
    ]);

    expect(result.exitCode).toBe(0);
    const outputPath = result.stdout.trim();
    const { height, width } = probeImage(outputPath);
    const left = readPixel(outputPath, 8, Math.floor(height / 2));
    const center = readPixel(outputPath, Math.floor(width / 2), Math.floor(height / 2));
    const right = readPixel(outputPath, width - 9, Math.floor(height / 2));
    expect(left[0]).toBeGreaterThan(left[2]);
    expect(center[1]).toBeGreaterThan(center[0]);
    expect(right[2]).toBeGreaterThan(right[0]);
  });

  test("centers and contains portrait sources without cropping", async () => {
    const input = join(inputDir, "contain-portrait.png");
    createFixture(input, "100x200", "red");

    const result = await runPrepareImageCli([
      input,
      "--out",
      join(outDir, "contain-portrait"),
      "--border-px",
      "10",
    ]);

    expect(result.exitCode).toBe(0);
    const outputPath = result.stdout.trim();
    expect(probeImage(outputPath)).toMatchObject({ height: 200, width: 150 });
    expect(readPixel(outputPath, 10, 100)).toEqual([255, 255, 255]);
    expect(readPixel(outputPath, 75, 100)[0]).toBeGreaterThan(240);
  });

  test("uses portrait output and a scaled one-pixel border for tiny square sources", async () => {
    const input = join(inputDir, "tiny-square.png");
    createFixture(input, "10x10", "red");

    const result = await runPrepareImageCli([
      input,
      "--out",
      join(outDir, "tiny-square"),
      "--border-px",
      "57",
    ]);

    expect(result.exitCode).toBe(0);
    const outputPath = result.stdout.trim();
    expect(probeImage(outputPath)).toMatchObject({ height: 16, width: 12 });
    expect(readPixel(outputPath, 0, 8).every((channel) => channel >= 200)).toBe(true);
    expect(readPixel(outputPath, 6, 8)[0]).toBeGreaterThan(240);
  });

  test("converts tagged Display-P3 input and marks the output as sRGB", async () => {
    const p3Input = join(inputDir, "display-p3.png");
    const untaggedInput = join(inputDir, "untagged-srgb.png");
    createTaggedDisplayP3Fixture(p3Input, "48x32", "0x00ff80");
    createFixture(untaggedInput, "48x32", "0x00ff80");

    const [p3Result, untaggedResult] = await Promise.all([
      runPrepareImageCli([p3Input, "--out", join(outDir, "display-p3"), "--border-px", "0"]),
      runPrepareImageCli([
        untaggedInput,
        "--out",
        join(outDir, "untagged-srgb"),
        "--border-px",
        "0",
      ]),
    ]);

    expect(p3Result.exitCode).toBe(0);
    expect(untaggedResult.exitCode).toBe(0);
    expect(hasSrgbColorSpaceTag(p3Result.stdout.trim())).toBe(true);
    expect(readPixel(p3Result.stdout.trim(), 24, 16)).not.toEqual(
      readPixel(untaggedResult.stdout.trim(), 24, 16),
    );
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

  // Dimensions alone cannot tell a correct rotation from a wrong one: orientations
  // 5-8 all swap width and height, but only one of them puts the right pixels in
  // the right corner. These expectations come from the EXIF spec, not from ffmpeg.
  const ORIENTATION_CORNER_EXPECTATIONS = {
    // Mirror horizontal + rotate 270 CW == transpose across the main diagonal.
    5: {
      bottomLeft: "topRight",
      bottomRight: "bottomRight",
      topLeft: "topLeft",
      topRight: "bottomLeft",
    },
    // Rotate 90 CW.
    6: {
      bottomLeft: "bottomRight",
      bottomRight: "topRight",
      topLeft: "bottomLeft",
      topRight: "topLeft",
    },
    // Mirror horizontal + rotate 90 CW == transpose across the anti-diagonal.
    7: {
      bottomLeft: "bottomLeft",
      bottomRight: "topLeft",
      topLeft: "bottomRight",
      topRight: "topRight",
    },
    // Rotate 270 CW.
    8: {
      bottomLeft: "topLeft",
      bottomRight: "bottomLeft",
      topLeft: "topRight",
      topRight: "bottomRight",
    },
  } as const satisfies Record<number, Record<QuadrantName, QuadrantName>>;

  for (const [orientation, expected] of Object.entries(ORIENTATION_CORNER_EXPECTATIONS)) {
    test(`places source pixels correctly for EXIF orientation ${orientation}`, async () => {
      const rawInput = join(inputDir, `raw-quadrants-${orientation}.jpg`);
      const orientedInput = join(inputDir, `quadrants-${orientation}.jpg`);
      createQuadrantFixture(rawInput);
      insertExifOrientation(rawInput, orientedInput, Number(orientation));

      const result = await runPrepareImageCli([
        orientedInput,
        "--out",
        join(outDir, `quadrants-${orientation}`),
        "--border-px",
        "0",
      ]);

      expect(result.exitCode).toBe(0);
      expect(probeImage(result.stdout.trim())).toMatchObject({ height: 40, width: 60 });
      expect(readCornerQuadrants(result.stdout.trim())).toEqual(expected);
    });
  }

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
    expect(hasExifOrientationTag(input)).toBe(true);
    expect(hasExifSegment(result.stdout.trim())).toBe(true);
    expect(hasExifOrientationTag(result.stdout.trim())).toBe(false);
    expect(hasSrgbColorSpaceTag(result.stdout.trim())).toBe(true);
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

  test("reports missing arguments and invalid directory destinations through the command interface", async () => {
    const missingInput = await runPrepareImageCli([]);
    const input = join(inputDir, "destination.png");
    createFixture(input, "48x32", "red");
    const missingOut = await runPrepareImageCli([input]);
    const missingOutValue = await runPrepareImageCli([input, "--out"]);
    const outputDirectory = mkdtempSync(join(outDir, "invalid-file-output-"));
    const invalidDestination = await runPrepareImageCli([input, "--out", outputDirectory]);
    const emptyInputDirectory = mkdtempSync(join(inputDir, "empty-"));
    const emptyDirectory = await runPrepareImageCli([
      emptyInputDirectory,
      "--out",
      join(outDir, "empty-output"),
    ]);
    const directoryInput = mkdtempSync(join(inputDir, "file-destination-"));
    createFixture(join(directoryInput, "photo.png"), "48x32", "red");
    const outputFile = join(outDir, "directory-output-file");
    writeFileSync(outputFile, "existing");
    const invalidDirectoryDestination = await runPrepareImageCli([
      directoryInput,
      "--out",
      outputFile,
    ]);

    expect(missingInput.exitCode).not.toBe(0);
    expect(missingInput.stderr).toContain("Usage:");
    expect(missingOut.stderr).toContain("Missing required --out");
    expect(missingOutValue.stderr).toContain("Missing value for --out");
    expect(invalidDestination.exitCode).not.toBe(0);
    expect(invalidDestination.stderr).toContain("--out must be a file path, not a directory");
    expect(emptyDirectory.stderr).toContain("No supported images found in directory");
    expect(invalidDirectoryDestination.stderr).toContain(
      "--out must be a directory for directory input",
    );
    expect(readFileSync(outputFile, "utf8")).toBe("existing");
  });
});
