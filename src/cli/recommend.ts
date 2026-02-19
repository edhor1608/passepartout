import {
  CANVAS_PROFILES,
  CANVAS_STYLES,
  MODES,
  ORIENTATIONS,
  SURFACES,
  WORKFLOWS,
  type CanvasProfile,
  type CanvasStyle,
  type Mode,
  type Orientation,
  type RecommendInput,
  type Surface,
  type Workflow,
} from "../types/contracts";
import { recommend, toStableJson } from "../domain/recommend";

type ParsedArgs = RecommendInput & { json: boolean };

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
    const next = argv[i + 1];

    switch (token) {
      case "--mode":
        if (!next || next.startsWith("--")) {
          throw new Error("Missing value for --mode");
        }
        mode = next as Mode;
        i += 1;
        break;
      case "--surface":
        if (!next || next.startsWith("--")) {
          throw new Error("Missing value for --surface");
        }
        surface = next as Surface;
        i += 1;
        break;
      case "--orientation":
        if (!next || next.startsWith("--")) {
          throw new Error("Missing value for --orientation");
        }
        orientation = next as Orientation;
        i += 1;
        break;
      case "--workflow":
        if (!next || next.startsWith("--")) {
          throw new Error("Missing value for --workflow");
        }
        workflow = next as Workflow;
        i += 1;
        break;
      case "--white-canvas":
        whiteCanvas = true;
        break;
      case "--canvas-profile":
        if (!next || next.startsWith("--")) {
          throw new Error("Missing value for --canvas-profile");
        }
        canvasProfile = next as CanvasProfile;
        i += 1;
        break;
      case "--canvas-style":
        if (!next || next.startsWith("--")) {
          throw new Error("Missing value for --canvas-style");
        }
        canvasStyle = next as CanvasStyle;
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

  if (!MODES.includes(mode)) {
    throw new Error(`Invalid mode: ${mode}`);
  }

  if (!SURFACES.includes(surface)) {
    throw new Error(`Invalid surface: ${surface}`);
  }

  if (!ORIENTATIONS.includes(orientation)) {
    throw new Error(`Invalid orientation: ${orientation}`);
  }

  if (!WORKFLOWS.includes(workflow)) {
    throw new Error(`Invalid workflow: ${workflow}`);
  }

  if (canvasProfile && !CANVAS_PROFILES.includes(canvasProfile)) {
    throw new Error(`Invalid canvas profile: ${canvasProfile}`);
  }

  if (canvasStyle && !CANVAS_STYLES.includes(canvasStyle)) {
    throw new Error(`Invalid canvas style: ${canvasStyle}`);
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
  const parsed = parseArgs(process.argv.slice(2));
  const result = recommend(parsed);

  if (parsed.json) {
    console.log(toStableJson(result));
    return;
  }

  printHumanOutput(result, parsed.surface, parsed.orientation);
}

main();
