import {
  CANVAS_PROFILES,
  CANVAS_STYLES,
  MODES,
  SURFACES,
  WORKFLOWS,
  type CanvasProfile,
  type CanvasStyle,
  type ExportVideoInput,
  type Mode,
  type Surface,
  type Workflow,
} from "../types/contracts";
import { exportVideo } from "../domain/export_video";
import { stableStringify } from "../domain/recommend";

type ParsedArgs = ExportVideoInput & { json: boolean };

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0 || argv[0]?.startsWith("--")) {
    throw new Error("Missing required positional arg: <file>");
  }

  const file = argv[0]!;
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
    const next = argv[i + 1];

    switch (token) {
      case "--out":
        if (!next || next.startsWith("--")) {
          throw new Error("Missing value for --out");
        }
        out = next;
        i += 1;
        break;
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
      case "--crf":
        if (!next || next.startsWith("--")) {
          throw new Error("Missing value for --crf");
        }
        crf = Number.parseInt(next ?? "", 10);
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

  if (!MODES.includes(mode)) {
    throw new Error(`Invalid mode: ${mode}`);
  }

  if (!SURFACES.includes(surface)) {
    throw new Error(`Invalid surface: ${surface}`);
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
  try {
    const parsed = parseArgs(process.argv.slice(2));
    const result = exportVideo(parsed);

    if (parsed.json) {
      console.log(stableStringify(result));
      return;
    }

    printHumanOutput(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
