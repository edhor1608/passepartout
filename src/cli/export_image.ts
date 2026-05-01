import type {
  CanvasProfile,
  CanvasStyle,
  ExportImageInput,
  Mode,
  Surface,
  Workflow,
} from "../types/contracts";
import {
  flagValue,
  integerFlagValue,
  parseCanvasProfile,
  parseCanvasStyle,
  parseMode,
  parseSurface,
  parseWorkflow,
  printHelpIfRequested,
  positional,
} from "./args";
import { exportImage } from "../domain/export_image";
import { stableStringify } from "../domain/recommend";

type ParsedArgs = ExportImageInput & { json: boolean };
const USAGE =
  "Usage: bun run export-image <file> --out <path> --mode <reliable|experimental> --surface <feed|story|reel> [--workflow <app_direct|api_scheduler|unknown>] [--white-canvas] [--canvas-profile <feed_compat|feed_app_direct>] [--canvas-style <gallery_clean|polaroid_classic>] [--quality <1..31>] [--json]";

function parseArgs(argv: string[]): ParsedArgs {
  const file = positional(argv, "file");
  let out: string | undefined;
  let mode: Mode | undefined;
  let surface: Surface | undefined;
  let workflow: Workflow = "unknown";
  let whiteCanvas = false;
  let canvasProfile: CanvasProfile | undefined;
  let canvasStyle: CanvasStyle | undefined;
  let quality: number | undefined;
  let json = false;

  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case "--out":
        out = flagValue(argv, i, "--out");
        i += 1;
        break;
      case "--mode":
        mode = parseMode(flagValue(argv, i, "--mode"));
        i += 1;
        break;
      case "--surface":
        surface = parseSurface(flagValue(argv, i, "--surface"));
        i += 1;
        break;
      case "--workflow":
        workflow = parseWorkflow(flagValue(argv, i, "--workflow"));
        i += 1;
        break;
      case "--white-canvas":
        whiteCanvas = true;
        break;
      case "--canvas-profile":
        canvasProfile = parseCanvasProfile(flagValue(argv, i, "--canvas-profile"));
        i += 1;
        break;
      case "--canvas-style":
        canvasStyle = parseCanvasStyle(flagValue(argv, i, "--canvas-style"));
        i += 1;
        break;
      case "--quality":
        quality = integerFlagValue(argv, i, "--quality");
        i += 1;
        break;
      case "--json":
        json = true;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!out || !mode || !surface) {
    throw new Error("Missing required args: --out --mode --surface");
  }

  if (quality !== undefined && (!Number.isFinite(quality) || quality < 1 || quality > 31)) {
    throw new Error(`Invalid quality: ${quality}`);
  }

  return { file, out, mode, surface, workflow, whiteCanvas, canvasProfile, canvasStyle, quality, json };
}

function printHumanOutput(result: ReturnType<typeof exportImage>): void {
  console.log(`Summary: exported ${result.input_path} -> ${result.output_path}`);
  console.log(`Target: ${result.target_resolution}`);
  console.log(`Profile: ${result.selected_profile}`);
  console.log(`White canvas: ${result.white_canvas_enabled ? "enabled" : "disabled"}`);
  console.log("Next action: run with --json for machine-readable output.");
}

function main(): void {
  const argv = process.argv.slice(2);
  if (printHelpIfRequested(argv, USAGE)) {
    return;
  }
  const parsed = parseArgs(argv);
  const result = exportImage(parsed);

  if (parsed.json) {
    console.log(stableStringify(result));
    return;
  }

  printHumanOutput(result);
}

main();
