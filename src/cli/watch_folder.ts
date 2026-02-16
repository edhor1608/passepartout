import type { CanvasProfile, CanvasStyle, Mode, Surface, WatchFolderInput, Workflow } from "../types/contracts";
import { stableStringify } from "../domain/recommend";
import { runWatchCycle } from "../domain/watch_folder";

type ParsedArgs = WatchFolderInput & { json: boolean };

function parseArgs(argv: string[]): ParsedArgs {
  let inDir: string | undefined;
  let outDir: string | undefined;
  let mode: Mode | undefined;
  let surface: Surface | undefined;
  let workflow: Workflow = "unknown";
  let whiteCanvas = false;
  let canvasProfile: CanvasProfile | undefined;
  let canvasStyle: CanvasStyle | undefined;
  let once = false;
  let intervalSeconds = 10;
  let json = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    switch (token) {
      case "--in":
        inDir = next;
        i += 1;
        break;
      case "--out":
        outDir = next;
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
      case "--once":
        once = true;
        break;
      case "--interval-sec":
        intervalSeconds = Number.parseInt(next ?? "", 10);
        i += 1;
        break;
      case "--json":
        json = true;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!inDir || !outDir || !mode || !surface) {
    throw new Error("Missing required args: --in --out --mode --surface");
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
  if (!Number.isFinite(intervalSeconds) || intervalSeconds < 1 || intervalSeconds > 3600) {
    throw new Error(`Invalid interval-sec: ${intervalSeconds}`);
  }

  return {
    inDir,
    outDir,
    mode,
    surface,
    workflow,
    whiteCanvas,
    canvasProfile,
    canvasStyle,
    once,
    intervalSeconds,
    json,
  };
}

function printHumanOutput(result: ReturnType<typeof runWatchCycle>): void {
  console.log(`Summary: processed=${result.processed_count} skipped=${result.skipped_count} errors=${result.error_count}`);
  console.log(`Input: ${result.input_dir}`);
  console.log(`Output: ${result.output_dir}`);
  console.log(`State: ${result.state_path}`);
  console.log("Next action: rerun with --json for machine-readable output.");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  while (true) {
    const result = runWatchCycle(parsed);

    if (parsed.json) {
      console.log(stableStringify(result));
    } else {
      printHumanOutput(result);
    }

    if (parsed.once) {
      break;
    }

    await delay((parsed.intervalSeconds ?? 10) * 1000);
  }
}

await main();
