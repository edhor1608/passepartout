import type {
  BenchmarkInput,
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
  printHelpIfRequested,
  positional,
} from "./args";
import { stableStringify } from "../domain/recommend";
import { benchmark } from "../domain/benchmark";

type ParsedArgs = BenchmarkInput & { json: boolean };
const USAGE =
  "Usage: bun run benchmark <file> --out <path> --mode <reliable|experimental> --surface <feed|story|reel> [--workflow <app_direct|api_scheduler|unknown>] [--white-canvas] [--canvas-profile <feed_compat|feed_app_direct>] [--canvas-style <gallery_clean|polaroid_classic>] [--json]";

function parseArgs(argv: string[]): ParsedArgs {
  const file = positional(argv, "file");
  let out: string | undefined;
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

  return { file, out, mode, surface, workflow, whiteCanvas, canvasProfile, canvasStyle, json };
}

function printHumanOutput(result: ReturnType<typeof benchmark>): void {
  console.log(
    `Summary: ${result.report_export.comparison.input_resolution} -> ${result.report_export.comparison.output_resolution}`,
  );
  console.log(`Score: ${result.score.total}/100 (${result.score.grade})`);
  console.log(
    `Breakdown: resolution=${result.score.resolution_score} bitrate=${result.score.bitrate_score} codec=${result.score.codec_score}`,
  );
  console.log(`Confidence: ${result.confidence.value} (${result.confidence.label})`);
  console.log("Next action: rerun with --json for machine-readable output.");
}

function main(): void {
  const argv = process.argv.slice(2);
  if (printHelpIfRequested(argv, USAGE)) {
    return;
  }
  const parsed = parseArgs(argv);
  const result = benchmark(parsed);

  if (parsed.json) {
    console.log(stableStringify(result));
    return;
  }

  printHumanOutput(result);
}

main();
