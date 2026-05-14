import { DEFAULT_PREPARE_IMAGE_BORDER_PX, prepareImage } from "../domain/prepare_image";

const USAGE = "Usage: bun run prepare-image <input> --out <file-path> [--border-px <integer>]";

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
  if (!inputPath || inputPath.startsWith("--")) {
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
      borderPx = parseBorderPx(value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${flag}`);
  }

  if (!outputPath) {
    throw new Error("Missing required --out <file-path>");
  }

  return { borderPx, inputPath, outputPath };
}

function readFlagValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

function parseBorderPx(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!/^\d+$/.test(value) || !Number.isInteger(parsed)) {
    throw new Error("Invalid --border-px value");
  }

  return parsed;
}

try {
  const parsed = parseArgs(Bun.argv.slice(2));
  if (parsed === "help") {
    console.log(USAGE);
    process.exit(0);
  }

  const result = prepareImage(parsed);
  console.log(result.outputPath);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
