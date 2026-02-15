import type {
  CanvasProfile,
  CanvasStyle,
  ExportImageInput,
  Mode,
  Surface,
  Workflow,
} from "../types/contracts";
import { exportImage } from "../domain/export_image";
import { stableStringify } from "../domain/recommend";

type ParsedArgs = ExportImageInput & { json: boolean };

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
  let quality: number | undefined;
  let json = false;

  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    switch (token) {
      case "--out":
        out = next;
        i += 1;
        break;
      case "--mode":
        mode = next as Mode;
        i += 1;
        break;
      case "--surface":
        surface = next as Surface;
        i += 1;
        break;
      case "--workflow":
        workflow = next as Workflow;
        i += 1;
        break;
      case "--white-canvas":
        whiteCanvas = true;
        break;
      case "--canvas-profile":
        canvasProfile = next as CanvasProfile;
        i += 1;
        break;
      case "--canvas-style":
        canvasStyle = next as CanvasStyle;
        i += 1;
        break;
      case "--quality":
        quality = Number.parseInt(next ?? "", 10);
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

  if (!["reliable", "experimental"].includes(mode)) {
    throw new Error(`Invalid mode: ${mode}`);
  }

  if (!["feed", "story", "reel"].includes(surface)) {
    throw new Error(`Invalid surface: ${surface}`);
  }

  if (!["app_direct", "api_scheduler", "unknown"].includes(workflow)) {
    throw new Error(`Invalid workflow: ${workflow}`);
  }

  if (canvasProfile && !["feed_compat", "feed_app_direct"].includes(canvasProfile)) {
    throw new Error(`Invalid canvas profile: ${canvasProfile}`);
  }

  if (canvasStyle && !["gallery_clean", "polaroid_classic"].includes(canvasStyle)) {
    throw new Error(`Invalid canvas style: ${canvasStyle}`);
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
  const parsed = parseArgs(process.argv.slice(2));
  const result = exportImage(parsed);

  if (parsed.json) {
    console.log(stableStringify(result));
    return;
  }

  printHumanOutput(result);
}

main();
