import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { GridPreviewOutput, OverlayRatio } from "../types/contracts";
import { stableStringify } from "../domain/recommend";
import { buildGridPreviewSvg, createGridPreview } from "../domain/grid_preview";

type ParsedArgs = {
  ratio: OverlayRatio;
  out?: string;
  json: boolean;
};

function requireValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseArgs(argv: string[]): ParsedArgs {
  let ratio: OverlayRatio | undefined;
  let out: string | undefined;
  let json = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    switch (token) {
      case "--ratio":
        ratio = requireValue(token, next) as OverlayRatio;
        if (!["4:5", "3:4", "9:16"].includes(ratio)) {
          throw new Error(`Invalid ratio: ${ratio}`);
        }
        i += 1;
        break;
      case "--out":
        out = requireValue(token, next);
        i += 1;
        break;
      case "--json":
        json = true;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!ratio) {
    throw new Error("Missing required args: --ratio");
  }

  return { ratio, out, json };
}

function printHumanOutput(result: GridPreviewOutput): void {
  console.log(`Summary: grid-preview ratio=${result.ratio} canvas=${result.canvas_resolution}`);
  console.log(
    `Grid crop square: left=${result.grid_crop_square.left} top=${result.grid_crop_square.top} right=${result.grid_crop_square.right} bottom=${result.grid_crop_square.bottom}`,
  );
  console.log(`Visible in grid: ${result.visible_fraction_percent}%`);
  if (result.output_svg_path) {
    console.log(`SVG: ${result.output_svg_path}`);
  }
  console.log("Next action: rerun with --json for machine-readable output.");
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  const preview = createGridPreview(parsed.ratio);
  const result: GridPreviewOutput = { ...preview };

  if (parsed.out) {
    const outputPath = resolve(parsed.out);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${buildGridPreviewSvg(preview)}\n`, "utf8");
    result.output_svg_path = outputPath;
  }

  if (parsed.json) {
    console.log(stableStringify(result));
    return;
  }

  printHumanOutput(result);
}

main();
