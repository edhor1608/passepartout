import type {
  AnalyzeInput,
  CanvasProfile,
  CanvasStyle,
  Mode,
  Surface,
  Workflow,
} from "../types/contracts";
import {
  flagValue,
  parseCanvasProfile,
  parseCanvasStyle,
  parseMode,
  parseSurface,
  parseWorkflow,
  positional,
} from "./args";
import { analyze } from "../domain/analyze";
import { stableStringify } from "../domain/recommend";

type ParsedArgs = AnalyzeInput & { json: boolean };

function parseArgs(argv: string[]): ParsedArgs {
  const file = positional(argv, "file");
  let mode: Mode | undefined;
  let surface: Surface | undefined;
  let workflow: Workflow = "unknown";
  let whiteCanvas = false;
  let canvasProfile: CanvasProfile | undefined;
  let canvasStyle: CanvasStyle | undefined;
  let json = false;

  for (let i = 1; i < argv.length; i += 1) {
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

  if (!mode || !surface) {
    throw new Error("Missing required args: --mode --surface");
  }

  return { file, mode, surface, workflow, whiteCanvas, canvasProfile, canvasStyle, json };
}

function printHumanOutput(result: ReturnType<typeof analyze>): void {
  console.log(`Summary: ${result.input.path} -> ${result.selection.target_resolution}`);
  console.log(
    `Input: ${result.input.width}x${result.input.height} orientation=${result.input.orientation} aspect=${result.input.aspect_ratio}`,
  );
  console.log(`Tier: ${result.tier.name} (${result.tier.risk_level}) - ${result.tier.reason}`);
  console.log(
    `Selection: mode=${result.selection.mode} surface=${result.selection.surface} profile=${result.selection.profile} workflow=${result.selection.workflow}`,
  );

  if (result.white_canvas.enabled) {
    console.log(
      `White canvas: profile=${result.white_canvas.profile} margins=${JSON.stringify(result.white_canvas.margins)} contain_only=${result.white_canvas.contain_only} no_crop=${result.white_canvas.no_crop}`,
    );
  } else {
    console.log("White canvas: disabled");
  }

  console.log("Next action: rerun with --json for machine-readable output.");
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  const result = analyze(parsed);

  if (parsed.json) {
    console.log(stableStringify(result));
    return;
  }

  printHumanOutput(result);
}

main();
