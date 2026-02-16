import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ValidateMatrixInput } from "../types/contracts";
import { stableStringify } from "../domain/recommend";
import { validateMatrix } from "../domain/validate_matrix";

type ParsedArgs = ValidateMatrixInput & {
  json: boolean;
  outJson?: string;
  outMd?: string;
  failOnError: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  let casesFile: string | undefined;
  let outJson: string | undefined;
  let outMd: string | undefined;
  let onlyIds: string[] | undefined;
  let onlyFile: string | undefined;
  let maxCases: number | undefined;
  let failOnError = false;
  let json = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    switch (token) {
      case "--cases":
        casesFile = next;
        i += 1;
        break;
      case "--out-json":
        outJson = next;
        i += 1;
        break;
      case "--out-md":
        outMd = next;
        i += 1;
        break;
      case "--only":
        onlyIds = (next ?? "")
          .split(",")
          .map((token) => token.trim())
          .filter((token) => token.length > 0);
        i += 1;
        break;
      case "--only-file":
        onlyFile = next;
        i += 1;
        break;
      case "--max-cases":
        if (!next || !/^[0-9]+$/.test(next)) {
          throw new Error("Invalid --max-cases value");
        }
        maxCases = Number.parseInt(next, 10);
        i += 1;
        break;
      case "--fail-on-error":
        failOnError = true;
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
  if (outJson !== undefined && outJson.length === 0) {
    throw new Error("Invalid --out-json path");
  }
  if (outMd !== undefined && outMd.length === 0) {
    throw new Error("Invalid --out-md path");
  }
  if (onlyIds !== undefined && onlyFile !== undefined) {
    throw new Error("Cannot combine --only with --only-file");
  }
  if (onlyFile !== undefined && onlyFile.length === 0) {
    throw new Error("Invalid --only-file path");
  }
  if (onlyIds !== undefined && onlyIds.length === 0) {
    throw new Error("Invalid --only list");
  }
  if (onlyFile) {
    const absOnlyFile = resolve(onlyFile);
    const parsedIds = readFileSync(absOnlyFile, "utf8")
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
    if (parsedIds.length === 0) {
      throw new Error("Invalid --only-file list");
    }
    onlyIds = parsedIds;
  }
  if (maxCases !== undefined && maxCases <= 0) {
    throw new Error("Invalid --max-cases value");
  }

  return { casesFile, outJson, outMd, onlyIds, maxCases, json, failOnError };
}

function buildMarkdownReport(result: ReturnType<typeof validateMatrix>): string {
  const lines: string[] = [];
  lines.push("# Validate Matrix Report");
  lines.push("");
  lines.push(`Cases total: ${result.cases_total}`);
  lines.push(`Cases skipped: ${result.cases_skipped}`);
  lines.push(`Cases succeeded: ${result.cases_succeeded}`);
  lines.push(`Cases failed: ${result.cases_failed}`);
  lines.push(`Duration ms: ${result.duration_ms}`);
  lines.push(`Selected case ids: ${result.selected_case_ids.join(", ")}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`Average total score: ${result.summary.avg_total_score ?? "n/a"}`);
  lines.push(`Average confidence: ${result.summary.avg_confidence ?? "n/a"}`);
  lines.push(
    `Grade counts: A=${result.summary.grade_counts.A} B=${result.summary.grade_counts.B} C=${result.summary.grade_counts.C} D=${result.summary.grade_counts.D}`,
  );
  lines.push(
    `Confidence counts: low=${result.summary.confidence_counts.low} medium=${result.summary.confidence_counts.medium} high=${result.summary.confidence_counts.high}`,
  );
  lines.push("");
  lines.push("## Cases");
  lines.push("");
  for (const row of result.results) {
    if (row.status === "ok" && row.benchmark) {
      lines.push(
        `- ${row.id}: ok score=${row.benchmark.score.total} grade=${row.benchmark.score.grade} confidence=${row.benchmark.confidence.value} (${row.benchmark.confidence.label}) duration_ms=${row.duration_ms}`,
      );
    } else {
      lines.push(`- ${row.id}: error message="${row.error ?? "unknown"}" duration_ms=${row.duration_ms}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function printHumanOutput(result: ReturnType<typeof validateMatrix>): void {
  console.log(
    `Summary: total=${result.cases_total} skipped=${result.cases_skipped} succeeded=${result.cases_succeeded} failed=${result.cases_failed}`,
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
  const payload = stableStringify(result);

  if (parsed.outJson) {
    const outPath = resolve(parsed.outJson);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${payload}\n`, "utf8");
  }
  if (parsed.outMd) {
    const outPath = resolve(parsed.outMd);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, buildMarkdownReport(result), "utf8");
  }

  if (parsed.failOnError && result.cases_failed > 0) {
    process.exitCode = 1;
  }

  if (parsed.json) {
    console.log(payload);
    return;
  }

  printHumanOutput(result);
}

function printError(message: string, json: boolean): void {
  if (json) {
    console.log(stableStringify({ error: message }));
    return;
  }
  console.error(`Error: ${message}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const json = process.argv.slice(2).includes("--json");
  printError(message, json);
  process.exitCode = 1;
}
