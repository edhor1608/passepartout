import type {
  CanvasProfile,
  CanvasStyle,
  ExportVideoInput,
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
  positional,
} from "./args";
import { exportVideo } from "../domain/export_video";
import { stableStringify } from "../domain/recommend";

type ParsedArgs = ExportVideoInput & { json: boolean };

function parseArgs(argv: string[]): ParsedArgs {
  const file = positional(argv, "file");
  let out: string | undefined;
  let mode: Mode | undefined;
  let surface: Surface | undefined;
  let workflow: Workflow = "unknown";
  let whiteCanvas = false;
  let canvasProfile: CanvasProfile | undefined;
  let canvasStyle: CanvasStyle | undefined;
  let crf: number | undefined;
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
      case "--crf":
        crf = integerFlagValue(argv, i, "--crf");
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

  if (crf !== undefined && (!Number.isFinite(crf) || crf < 0 || crf > 51)) {
    throw new Error(`Invalid crf: ${crf}`);
  }

  return { file, out, mode, surface, workflow, whiteCanvas, canvasProfile, canvasStyle, crf, json };
}

function printHumanOutput(result: ReturnType<typeof exportVideo>): void {
  console.log(`Summary: exported ${result.input_path} -> ${result.output_path}`);
  console.log(`Target: ${result.target_resolution}`);
  console.log(`Profile: ${result.selected_profile}`);
  console.log(`Video: codec=${result.video_codec} fps=${result.fps}`);
  console.log(`White canvas: ${result.white_canvas_enabled ? "enabled" : "disabled"}`);
  console.log("Next action: run with --json for machine-readable output.");
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  const result = exportVideo(parsed);

  if (parsed.json) {
    console.log(stableStringify(result));
    return;
  }

  printHumanOutput(result);
}

main();
