import type { CanvasProfile, CanvasStyle, Mode, Surface, WatchFolderInput, Workflow } from "../types/contracts";
import {
  flagValue,
  integerFlagValue,
  parseCanvasProfile,
  parseCanvasStyle,
  parseMode,
  parseSurface,
  parseWorkflow,
  printHelpIfRequested,
} from "./args";
import { stableStringify } from "../domain/recommend";
import { runWatchCycle } from "../domain/watch_folder";

type ParsedArgs = WatchFolderInput & { json: boolean };
const USAGE =
  "Usage: bun run watch-folder --in <dir> --out <dir> --mode <reliable|experimental> --surface <feed|story|reel> [--workflow <app_direct|api_scheduler|unknown>] [--white-canvas] [--canvas-profile <feed_compat|feed_app_direct>] [--canvas-style <gallery_clean|polaroid_classic>] [--once] [--interval-sec <seconds>] [--max-cycles <count>] [--json]";

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
  let maxCycles: number | undefined;
  let json = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case "--in":
        inDir = flagValue(argv, i, "--in");
        i += 1;
        break;
      case "--out":
        outDir = flagValue(argv, i, "--out");
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
      case "--once":
        once = true;
        break;
      case "--interval-sec":
        intervalSeconds = integerFlagValue(argv, i, "--interval-sec");
        i += 1;
        break;
      case "--max-cycles":
        maxCycles = integerFlagValue(argv, i, "--max-cycles");
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
  if (!Number.isFinite(intervalSeconds) || intervalSeconds < 1 || intervalSeconds > 3600) {
    throw new Error(`Invalid interval-sec: ${intervalSeconds}`);
  }
  if (maxCycles !== undefined && (!Number.isFinite(maxCycles) || maxCycles < 1 || maxCycles > 100000)) {
    throw new Error(`Invalid max-cycles: ${maxCycles}`);
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
    maxCycles,
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
  const argv = process.argv.slice(2);
  if (printHelpIfRequested(argv, USAGE)) {
    return;
  }
  const parsed = parseArgs(argv);
  let cycles = 0;

  while (true) {
    cycles += 1;
    const result = runWatchCycle(parsed);

    if (parsed.json) {
      console.log(stableStringify(result));
    } else {
      printHumanOutput(result);
    }

    if (parsed.once) {
      break;
    }
    if (parsed.maxCycles !== undefined && cycles >= parsed.maxCycles) {
      break;
    }

    await delay((parsed.intervalSeconds ?? 10) * 1000);
  }
}

await main();
