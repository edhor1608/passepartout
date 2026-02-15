import type {
  CanvasProfile,
  Mode,
  ReportExportInput,
  Surface,
  Workflow,
} from "../types/contracts";
import { stableStringify } from "../domain/recommend";
import { buildReportExport } from "../domain/report_export";

type ParsedArgs = ReportExportInput & { json: boolean };

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

  return { file, out, mode, surface, workflow, whiteCanvas, canvasProfile, json };
}

function printHumanOutput(result: ReturnType<typeof buildReportExport>): void {
  console.log(`Summary: ${result.input_analyze.input.path} -> ${result.export.output_path}`);
  console.log(
    `Comparison: ${result.comparison.input_resolution} -> ${result.comparison.output_resolution} target=${result.comparison.target_resolution}`,
  );
  console.log(`Output matches target: ${result.comparison.output_matches_target ? "yes" : "no"}`);
  if (result.comparison.bitrate_delta_kbps !== null) {
    console.log(`Bitrate delta (kbps): ${result.comparison.bitrate_delta_kbps}`);
  }
  if (result.comparison.notes.length > 0) {
    console.log("Notes:");
    for (const note of result.comparison.notes) {
      console.log(`- ${note}`);
    }
  }
  console.log("Next action: rerun with --json for machine-readable output.");
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  const result = buildReportExport(parsed);

  if (parsed.json) {
    console.log(stableStringify(result));
    return;
  }

  printHumanOutput(result);
}

main();
