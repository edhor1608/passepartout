import {
  CANVAS_PROFILES,
  MODES,
  SURFACES,
  WORKFLOWS,
  type BenchmarkInput,
  type CanvasProfile,
  type Mode,
  type Surface,
  type Workflow,
} from "../types/contracts";
import { stableStringify } from "../domain/recommend";
import { benchmark } from "../domain/benchmark";

type ParsedArgs = BenchmarkInput & { json: boolean };

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
  let json = false;

  const requireValue = (flag: string, value: string | undefined): string => {
    if (value === undefined) {
      throw new Error(`Missing value for ${flag}`);
    }
    if (value.startsWith("--")) {
      throw new Error(`Invalid value for ${flag}: expected argument but got flag ${value}`);
    }
    return value;
  };

  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    switch (token) {
      case "--out":
        out = requireValue("--out", next);
        i += 1;
        break;
      case "--mode":
        mode = requireValue("--mode", next) as Mode;
        i += 1;
        break;
      case "--surface":
        surface = requireValue("--surface", next) as Surface;
        i += 1;
        break;
      case "--workflow":
        workflow = requireValue("--workflow", next) as Workflow;
        i += 1;
        break;
      case "--white-canvas":
        whiteCanvas = true;
        break;
      case "--canvas-profile":
        canvasProfile = requireValue("--canvas-profile", next) as CanvasProfile;
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

  return { file, out, mode, surface, workflow, whiteCanvas, canvasProfile, json };
}

function printHumanOutput(result: ReturnType<typeof benchmark>): void {
  console.log(
    `Summary: ${result.report_export.comparison.input_resolution} -> ${result.report_export.comparison.output_resolution}`,
  );
  console.log(`Score: ${result.score.total}/100 (${result.score.grade})`);
  console.log(
    `Breakdown: resolution=${result.score.resolution_score} bitrate=${result.score.bitrate_score} codec=${result.score.codec_score}`,
  );
  console.log("Next action: rerun with --json for machine-readable output.");
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  const result = benchmark(parsed);

  if (parsed.json) {
    console.log(stableStringify(result));
    return;
  }

  printHumanOutput(result);
}

main();
