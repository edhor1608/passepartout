import type { ValidateMatrixInput } from "../types/contracts";
import { stableStringify } from "../domain/recommend";
import { validateMatrix } from "../domain/validate_matrix";

type ParsedArgs = ValidateMatrixInput & { json: boolean };

function parseArgs(argv: string[]): ParsedArgs {
  let casesFile: string | undefined;
  let json = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    switch (token) {
      case "--cases":
        casesFile = next;
        i += 1;
        break;
      case "--json":
        json = true;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!casesFile) {
    throw new Error("Missing required args: --cases");
  }

  return { casesFile, json };
}

function printHumanOutput(result: ReturnType<typeof validateMatrix>): void {
  console.log(
    `Summary: total=${result.cases_total} succeeded=${result.cases_succeeded} failed=${result.cases_failed}`,
  );
  for (const row of result.results) {
    if (row.status === "ok" && row.benchmark) {
      console.log(`- ${row.id}: ok score=${row.benchmark.score.total} grade=${row.benchmark.score.grade}`);
    } else {
      console.log(`- ${row.id}: error ${row.error ?? "unknown"}`);
    }
  }
  console.log("Next action: rerun with --json for machine-readable output.");
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  const result = validateMatrix(parsed);

  if (parsed.json) {
    console.log(stableStringify(result));
    return;
  }

  printHumanOutput(result);
}

main();
