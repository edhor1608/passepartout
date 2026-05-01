import type {
  CanvasProfile,
  CanvasStyle,
  Mode,
  ReportInput,
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
import { buildReport } from "../domain/report";

type ParsedArgs = ReportInput & { json: boolean };
const USAGE =
  "Usage: bun run report <file> --mode <reliable|experimental> --surface <feed|story|reel> [--workflow <app_direct|api_scheduler|unknown>] [--white-canvas] [--canvas-profile <feed_compat|feed_app_direct>] [--canvas-style <gallery_clean|polaroid_classic>] [--json]";

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

function printHumanOutput(result: ReturnType<typeof buildReport>): void {
  const analyzed = result.analyze;
  console.log(`Summary: ${analyzed.input.path} -> ${analyzed.selection.target_resolution}`);
  console.log(`Tier: ${analyzed.tier.name} (${analyzed.tier.risk_level})`);
  console.log("Checks:");
  for (const check of result.checks) {
    console.log(`- [${check.status}] ${check.label}: ${check.message}`);
  }
  console.log("Next actions:");
  for (const action of result.next_actions) {
    console.log(`- ${action}`);
  }
  console.log("Next action: rerun with --json for machine-readable output.");
}

function main(): void {
  const argv = process.argv.slice(2);
  if (printHelpIfRequested(argv, USAGE)) {
    return;
  }
  const parsed = parseArgs(argv);
  const result = buildReport(parsed);

  if (parsed.json) {
    console.log(stableStringify(result));
    return;
  }

  printHumanOutput(result);
}

main();
