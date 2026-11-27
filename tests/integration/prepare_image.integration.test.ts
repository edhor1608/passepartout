import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
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

function createFixture(path: string, size: string, color: string, extraFilter?: string): void {
  const source = `color=c=${color}:s=${size}`;
  const result = runTool([
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    extraFilter === undefined ? source : `${source},${extraFilter}`,
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

const SECRETS = ["Exif\0\0", "SecretCam", "SecretXmp", "SecretComment"];

function jpegSegment(marker: number, payload: Buffer): Buffer {
  const header = Buffer.from([0xff, marker, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

// Camera-like EXIF: Make precedes Orientation in IFD0, and an XMP APP1 segment
// comes first, so the reader must walk segments and IFD entries.
function buildExif(orientation: number, byteOrder: "II" | "MM"): Buffer {
  const make = Buffer.from("SecretCam\0", "ascii");
  const tiff = Buffer.alloc(8 + 2 + 2 * 12 + 4);
  const u16 = (value: number, at: number): number =>
    byteOrder === "II" ? tiff.writeUInt16LE(value, at) : tiff.writeUInt16BE(value, at);
  const u32 = (value: number, at: number): number =>
    byteOrder === "II" ? tiff.writeUInt32LE(value, at) : tiff.writeUInt32BE(value, at);
  tiff.write(byteOrder, 0, "ascii");
  u16(42, 2);
  u32(8, 4);
  u16(2, 8);
  u16(0x010f, 10);
  u16(2, 12);
  u32(make.length, 14);
  u32(tiff.length, 18);
  u16(0x0112, 22);
  u16(3, 24);
  u32(1, 26);
  u16(orientation, 30);
  return Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff, make]);
}

function insertMetadata(
  inputPath: string,
  outputPath: string,
  { orientation, byteOrder = "MM" }: { orientation: number; byteOrder?: "II" | "MM" },
): void {
  const input = readFileSync(inputPath);
  const app0Length = input.readUInt16BE(4);
  if (input.readUInt16BE(0) !== 0xffd8 || input[3] !== 0xe0) {
    throw new Error("Expected a JFIF JPEG input");
  }

  const afterApp0 = 4 + app0Length;
  const xmp = Buffer.from(
    "http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>SecretXmp</x:xmpmeta>",
    "ascii",
  );
  writeFileSync(
    outputPath,
    Buffer.concat([
      input.subarray(0, afterApp0),
      jpegSegment(0xe1, xmp),
      jpegSegment(0xe1, buildExif(orientation, byteOrder)),
      jpegSegment(0xfe, Buffer.from("SecretComment", "ascii")),
      input.subarray(afterApp0),
    ]),
  );
}

function leakedSecrets(path: string): string[] {
  const bytes = readFileSync(path);
  return SECRETS.filter((secret) => bytes.includes(Buffer.from(secret, "ascii")));
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

function readPsnr(path: string, referencePath: string): number {
  const result = runTool([
    "ffmpeg",
    "-hide_banner",
    "-i",
    path,
    "-i",
    referencePath,
    "-lavfi",
    "[0:v]format=rgb24[a];[1:v]format=rgb24[b];[a][b]psnr",
    "-f",
    "null",
    "-",
  ]);
  const average = /average:([\d.]+)/.exec(result.stderr)?.[1];
  if (result.exitCode !== 0 || average === undefined) {
    throw new Error(result.stderr);
  }

  return Number(average);
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
    const requestedOut = join(outDir, "new-parent", "photo.png");
    const result = await runPrepareImageCli([input, "--out", requestedOut, "--border-px", "0"]);

    const actualOut = join(outDir, "new-parent", "photo.jpg");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(`${actualOut}\n`);
    expect(result.stderr).toBe("");
    expect(existsSync(actualOut)).toBe(true);
    expect(probeImage(actualOut)).toMatchObject({ codec_name: "mjpeg", height: 32, width: 48 });
  });

  test("exports supported images from a directory into an output directory", async () => {
    const batchInputDir = mkdtempSync(join(inputDir, "batch-"));
    const batchOutDir = join(outDir, "batch-output", "nested");
    const inputs = [
      { name: "a-portrait.jpg", size: { height: 40, width: 30 } },
      { name: "b-landscape.png", size: { height: 32, width: 48 } },
      { name: "c-photo.jpeg", size: { height: 40, width: 30 } },
      { name: "d-scan.TIF", size: { height: 32, width: 48 } },
      { name: "e-scan.tiff", size: { height: 40, width: 30 } },
    ];
    for (const { name, size } of inputs) {
      createFixture(join(batchInputDir, name), `${size.width}x${size.height}`, "red");
    }
    mkdirSync(join(batchInputDir, "folder.png"));
    writeFileSync(join(batchInputDir, "notes.txt"), "skip");

    const result = await runPrepareImageCli([
      batchInputDir,
      "--out",
      batchOutDir,
      "--border-px",
      "0",
    ]);

    const outputs = inputs.map(({ name }) => join(batchOutDir, `${parse(name).name}.jpg`));
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(outputs.map((output) => `${output}\n`).join(""));
    expect(result.stderr).toBe("");
    for (const [index, { size }] of inputs.entries()) {
      expect(probeImage(outputs[index] ?? "")).toMatchObject({ codec_name: "mjpeg", ...size });
    }
  });

  test("fails on a directory without supported images", async () => {
    const emptyInputDir = mkdtempSync(join(inputDir, "empty-"));
    writeFileSync(join(emptyInputDir, "notes.txt"), "skip");

    const result = await runPrepareImageCli([emptyInputDir, "--out", join(outDir, "empty")]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("No supported images");
  });

  test.each([
    { args: [], border: 57 },
    { args: ["--border-px", "120"], border: 120 },
  ])("draws a $border px border on full-size landscape exports", async ({ args, border }) => {
    const input = join(inputDir, `border-${border}.png`);
    createFixture(input, "2160x1440", "red");

    const result = await runPrepareImageCli([
      input,
      "--out",
      join(outDir, `border-${border}`),
      ...args,
    ]);

    expect(result.exitCode).toBe(0);
    expect(readPixel(result.stdout.trim(), border / 2, 720)).toEqual([255, 255, 255]);
    expect(readPixel(result.stdout.trim(), border, 720)).not.toEqual([255, 255, 255]);
  });

  test("crops the center of a wide landscape source instead of squashing it", async () => {
    const input = join(inputDir, "wide.png");
    createFixture(
      input,
      "80x40",
      "red",
      "drawbox=x=0:w=10:h=40:color=blue:t=fill,drawbox=x=70:w=10:h=40:color=blue:t=fill",
    );

    const result = await runPrepareImageCli([
      input,
      "--out",
      join(outDir, "wide"),
      "--border-px",
      "0",
    ]);

    expect(result.exitCode).toBe(0);
    expect(probeImage(result.stdout.trim())).toMatchObject({ height: 40, width: 60 });
    for (const x of [1, 58]) {
      const [r, , b] = readPixel(result.stdout.trim(), x, 20);
      expect(r).toBeGreaterThan(200);
      expect(b).toBeLessThan(60);
    }
  });

  test("exports at near-lossless JPEG quality", async () => {
    const input = join(inputDir, "detail.png");
    const pattern = runTool([
      "ffmpeg",
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=s=360x240",
      "-frames:v",
      "1",
      input,
    ]);
    if (pattern.exitCode !== 0) {
      throw new Error(pattern.stderr);
    }

    const result = await runPrepareImageCli([
      input,
      "--out",
      join(outDir, "detail"),
      "--border-px",
      "0",
    ]);

    expect(result.exitCode).toBe(0);
    expect(readPsnr(result.stdout.trim(), input)).toBeGreaterThan(36.5);
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

  test.each([
    {
      byteOrder: "MM",
      extension: "jpg",
      orientation: 3,
      redAt: [24, 60],
      size: { height: 64, width: 48 },
      source: "48x64",
    },
    {
      byteOrder: "II",
      extension: "jpg",
      orientation: 5,
      redAt: [5, 20],
      size: { height: 40, width: 60 },
      source: "40x60",
    },
    {
      byteOrder: "MM",
      extension: "jpg",
      orientation: 6,
      redAt: [55, 20],
      size: { height: 40, width: 60 },
      source: "40x60",
    },
    {
      byteOrder: "II",
      extension: "JPG",
      orientation: 7,
      redAt: [55, 20],
      size: { height: 40, width: 60 },
      source: "40x60",
    },
    {
      byteOrder: "II",
      extension: "jpeg",
      orientation: 8,
      redAt: [5, 20],
      size: { height: 40, width: 60 },
      source: "40x60",
    },
  ] as const)(
    "applies EXIF orientation $orientation ($byteOrder, .$extension) to pixels and output ratio",
    async ({ byteOrder, extension, orientation, redAt: [x, y], size, source }) => {
      const rawInput = join(inputDir, `raw-orientation-${orientation}.jpg`);
      const orientedInput = join(inputDir, `oriented-${orientation}.${extension}`);
      createFixture(rawInput, source, "red", "drawbox=y=ih/2:w=iw:h=ih/2:color=blue:t=fill");
      insertMetadata(rawInput, orientedInput, { byteOrder, orientation });

      const result = await runPrepareImageCli([
        orientedInput,
        "--out",
        join(outDir, `oriented-${orientation}`),
        "--border-px",
        "0",
      ]);

      expect(result.exitCode).toBe(0);
      const output = result.stdout.trim();
      expect(probeImage(output)).toMatchObject(size);
      const [r, , b] = readPixel(output, x, y);
      expect(r).toBeGreaterThan(200);
      expect(b).toBeLessThan(60);
    },
  );

  test("strips EXIF, XMP, and comment metadata from the output", async () => {
    const rawInput = join(inputDir, "raw-metadata.jpg");
    const input = join(inputDir, "metadata.jpg");
    createFixture(rawInput, "48x32", "red");
    insertMetadata(rawInput, input, { orientation: 1 });

    const result = await runPrepareImageCli([
      input,
      "--out",
      join(outDir, "metadata"),
      "--border-px",
      "0",
    ]);

    expect(result.exitCode).toBe(0);
    expect(leakedSecrets(input)).toEqual(SECRETS);
    expect(leakedSecrets(result.stdout.trim())).toEqual([]);
  });

  test("rejects invalid border values, unknown flags, and a missing --out", async () => {
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
    const missingOut = await runPrepareImageCli([input]);

    expect(badBorder.exitCode).not.toBe(0);
    expect(badBorder.stderr).toContain("Invalid --border-px value");
    expect(badFlag.exitCode).not.toBe(0);
    expect(badFlag.stderr).toContain("Unknown option: --json");
    expect(missingOut.exitCode).not.toBe(0);
    expect(missingOut.stdout).toBe("");
    expect(missingOut.stderr).toContain("--out");
  });
});
