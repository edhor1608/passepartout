import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { OverlayOutput, OverlayRatio } from "../types/contracts";
import { buildOverlaySvg, createOverlay } from "../domain/overlay";
import { stableStringify } from "../domain/recommend";

type ParsedArgs = {
  ratio: OverlayRatio;
  out?: string;
  json: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  let ratio: OverlayRatio | undefined;
  let out: string | undefined;
  let json = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    switch (token) {
      case "--ratio":
        ratio = next as OverlayRatio;
        i += 1;
        break;
      case "--out":
        out = next;
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
  if (!["4:5", "3:4", "9:16"].includes(ratio)) {
    throw new Error(`Invalid ratio: ${ratio}`);
  }

  return { ratio, out, json };
}

function printHumanOutput(result: OverlayOutput): void {
  console.log(`Summary: overlay ratio=${result.ratio} canvas=${result.canvas_resolution}`);
  console.log(
    `Safe zone: left=${result.safe_zone.left} top=${result.safe_zone.top} right=${result.safe_zone.right} bottom=${result.safe_zone.bottom}`,
  );
  console.log(
    `Thirds: vertical=${result.thirds.vertical.join(",")} horizontal=${result.thirds.horizontal.join(",")}`,
  );
  if (result.output_svg_path) {
    console.log(`SVG: ${result.output_svg_path}`);
  }
  console.log("Next action: rerun with --json for machine-readable output.");
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  const overlay = createOverlay(parsed.ratio);
  const result: OverlayOutput = { ...overlay };

  if (parsed.out) {
    const outputPath = resolve(parsed.out);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${buildOverlaySvg(overlay)}\n`, "utf8");
    result.output_svg_path = outputPath;
  }

  if (parsed.json) {
    console.log(stableStringify(result));
    return;
  }

  printHumanOutput(result);
}

main();
