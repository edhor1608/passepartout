import type {
  CanvasProfile,
  CanvasStyle,
  Mode,
  Orientation,
  RecommendInput,
  Surface,
  Workflow,
} from "../types/contracts";
import {
  flagValue,
  parseCanvasProfile,
  parseCanvasStyle,
  parseMode,
  parseOrientation,
  parseSurface,
  parseWorkflow,
  printHelpIfRequested,
} from "./args";
import { recommend, toStableJson } from "../domain/recommend";

type ParsedArgs = RecommendInput & { json: boolean };
const USAGE =
  "Usage: bun run recommend --mode <reliable|experimental> --surface <feed|story|reel> --orientation <portrait|square|landscape> [--workflow <app_direct|api_scheduler|unknown>] [--white-canvas] [--canvas-profile <feed_compat|feed_app_direct>] [--canvas-style <gallery_clean|polaroid_classic>] [--json]";

function parseArgs(argv: string[]): ParsedArgs {
  let mode: Mode | undefined;
  let surface: Surface | undefined;
  let orientation: Orientation | undefined;
  let workflow: Workflow = "unknown";
  let whiteCanvas = false;
  let canvasProfile: CanvasProfile | undefined;
  let canvasStyle: CanvasStyle | undefined;
  let json = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case "--mode":
        mode = parseMode(flagValue(argv, i, "--mode"));
        i += 1;
        break;
      case "--surface":
        surface = parseSurface(flagValue(argv, i, "--surface"));
        i += 1;
        break;
      case "--orientation":
        orientation = parseOrientation(flagValue(argv, i, "--orientation"));
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
      case "--json":
        json = true;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!mode || !surface || !orientation) {
    throw new Error("Missing required args: --mode --surface --orientation");
  }

  return { mode, surface, orientation, workflow, whiteCanvas, canvasProfile, canvasStyle, json };
}

function printHumanOutput(result: ReturnType<typeof recommend>, surface: Surface, orientation: Orientation): void {
  console.log(`Summary: ${result.selected_mode} ${surface} ${orientation} -> ${result.target_resolution}`);
  console.log(`Profile: ${result.selected_profile}`);
  console.log(`Reason: ${result.reason}`);

  if (result.risk_level !== "low") {
    console.log(`Warnings: risk_level=${result.risk_level}`);
  } else {
    console.log("Warnings: none");
  }

  console.log(`Workflow note: ${result.workflow_note}`);

  if (result.white_canvas.enabled) {
    console.log(
      `White canvas: profile=${result.white_canvas.profile} margins=${JSON.stringify(result.white_canvas.margins)} contain_only=${result.white_canvas.contain_only} no_crop=${result.white_canvas.no_crop}`,
    );
  }

  console.log("Next action: run with --json for machine-readable output.");
}

function main(): void {
  const argv = process.argv.slice(2);
  if (printHelpIfRequested(argv, USAGE)) {
    return;
  }
  const parsed = parseArgs(argv);
  const result = recommend(parsed);

  if (parsed.json) {
    console.log(toStableJson(result));
    return;
  }

  printHumanOutput(result, parsed.surface, parsed.orientation);
}

main();
