import type {
  CanvasProfile,
  Mode,
  ReportInput,
  Surface,
  Workflow,
} from "../types/contracts";
import { stableStringify } from "../domain/recommend";
import { buildReport } from "../domain/report";

type ParsedArgs = ReportInput & { json: boolean };

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0 || argv[0]?.startsWith("--")) {
    throw new Error("Missing required positional arg: <file>");
  }

  const file = argv[0]!;
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

  if (!mode || !surface) {
    throw new Error("Missing required args: --mode --surface");
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

  return { file, mode, surface, workflow, whiteCanvas, canvasProfile, json };
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
  const parsed = parseArgs(process.argv.slice(2));
  const result = buildReport(parsed);

  if (parsed.json) {
    console.log(stableStringify(result));
    return;
  }

  printHumanOutput(result);
}

main();
