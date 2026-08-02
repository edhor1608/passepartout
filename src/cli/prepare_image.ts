import { mkdirSync, readdirSync, statSync } from "node:fs";
import { join, parse, resolve } from "node:path";
import { DEFAULT_PREPARE_IMAGE_BORDER_PX, prepareImage } from "../domain/prepare_image";

const USAGE =
  "Usage: bun run prepare-image <input> --out <file-path-or-directory> [--border-px <integer>]";
const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".tif", ".tiff"]);

type ParsedArgs = {
  inputPath: string;
  outputPath: string;
  borderPx: number;
};

function parseArgs(args: string[]): ParsedArgs | "help" {
  if (args.length === 1 && args[0] === "--help") {
    return "help";
  }

  const inputPath = args[0];
  if (inputPath === undefined || inputPath === "" || inputPath.startsWith("--")) {
    throw new Error(USAGE);
  }

  let outputPath: string | undefined;
  let borderPx = DEFAULT_PREPARE_IMAGE_BORDER_PX;

  for (let index = 1; index < args.length; index += 1) {
    const flag = args[index];

    if (flag === "--out") {
      outputPath = readFlagValue(args, index, "--out");
      index += 1;
      continue;
    }

    if (flag === "--border-px") {
      const value = readFlagValue(args, index, "--border-px");
      const parsedBorderPx = Number.parseInt(value, 10);
      if (!/^\d+$/.test(value) || !Number.isInteger(parsedBorderPx)) {
        throw new Error("Invalid --border-px value");
      }
      borderPx = parsedBorderPx;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${flag}`);
  }

  if (outputPath === undefined) {
    throw new Error("Missing required --out <file-path>");
  }

  return { borderPx, inputPath, outputPath };
}

function readFlagValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined || value === "" || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

try {
  const parsed = parseArgs(Bun.argv.slice(2));
  if (parsed === "help") {
    console.log(USAGE);
    process.exit(0);
  }

  const outputPaths = prepareInput(parsed);
  for (const outputPath of outputPaths) {
    console.log(outputPath);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function prepareInput(parsed: ParsedArgs): string[] {
  const inputPath = resolve(parsed.inputPath);
  const inputStat = statSync(inputPath);

  if (!inputStat.isDirectory()) {
    return [prepareImage(parsed).outputPath];
  }

  const outputPath = resolve(parsed.outputPath);
  let existingOutputStat: ReturnType<typeof statSync> | null = null;
  try {
    existingOutputStat = statSync(outputPath);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
  if (existingOutputStat?.isFile() === true) {
    throw new Error("--out must be a directory for directory input");
  }

  mkdirSync(outputPath, { recursive: true });
  const inputPaths = readdirSync(inputPath)
    .filter((entry) => SUPPORTED_EXTENSIONS.has(parse(entry).ext.toLowerCase()))
    .sort()
    .map((entry) => join(inputPath, entry))
    .filter((entryPath) => statSync(entryPath).isFile());

  if (inputPaths.length === 0) {
    throw new Error("No supported images found in directory");
  }

  return inputPaths.map((sourcePath) => {
    const outputBase = join(outputPath, parse(sourcePath).name);
    return prepareImage({
      borderPx: parsed.borderPx,
      inputPath: sourcePath,
      outputPath: outputBase,
    }).outputPath;
  });
}
