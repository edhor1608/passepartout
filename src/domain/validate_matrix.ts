import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import type {
  CanvasProfile,
  CanvasStyle,
  Mode,
  Surface,
  ValidateMatrixCase,
  ValidateMatrixInput,
  ValidateMatrixOutput,
  Workflow,
} from "../types/contracts";
import { benchmark } from "./benchmark";

type RawCase = {
  id?: unknown;
  file?: unknown;
  out?: unknown;
  mode?: unknown;
  surface?: unknown;
  workflow?: unknown;
  whiteCanvas?: unknown;
  canvasProfile?: unknown;
  canvasStyle?: unknown;
};

const VALID_MODES = new Set<Mode>(["reliable", "experimental"]);
const VALID_SURFACES = new Set<Surface>(["feed", "story", "reel"]);
const VALID_WORKFLOWS = new Set<Workflow>(["app_direct", "api_scheduler", "unknown"]);
const VALID_CANVAS_PROFILES = new Set<CanvasProfile>(["feed_compat", "feed_app_direct"]);
const VALID_CANVAS_STYLES = new Set<CanvasStyle>(["gallery_clean", "polaroid_classic"]);

function parseCases(casesFile: string): ValidateMatrixCase[] {
  const absCasesFile = resolve(casesFile);
  const baseDir = dirname(absCasesFile);
  const raw = JSON.parse(readFileSync(absCasesFile, "utf8")) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error(`Invalid matrix cases file: expected array at ${absCasesFile}`);
  }

  return raw.map((entry, index) => {
    const row = entry as RawCase;
    const id = row.id;
    const file = row.file;
    const out = row.out;
    const mode = row.mode;
    const surface = row.surface;

    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`Invalid case at index ${index}: id must be non-empty string`);
    }
    if (typeof file !== "string" || file.length === 0) {
      throw new Error(`Invalid case ${id}: file must be non-empty string`);
    }
    if (typeof out !== "string" || out.length === 0) {
      throw new Error(`Invalid case ${id}: out must be non-empty string`);
    }
    if (typeof mode !== "string" || !VALID_MODES.has(mode as Mode)) {
      throw new Error(`Invalid case ${id}: mode must be reliable|experimental`);
    }
    if (typeof surface !== "string" || !VALID_SURFACES.has(surface as Surface)) {
      throw new Error(`Invalid case ${id}: surface must be feed|story|reel`);
    }

    const workflow = row.workflow;
    if (workflow !== undefined && (typeof workflow !== "string" || !VALID_WORKFLOWS.has(workflow as Workflow))) {
      throw new Error(`Invalid case ${id}: workflow must be app_direct|api_scheduler|unknown`);
    }

    const canvasProfile = row.canvasProfile;
    if (
      canvasProfile !== undefined &&
      (typeof canvasProfile !== "string" || !VALID_CANVAS_PROFILES.has(canvasProfile as CanvasProfile))
    ) {
      throw new Error(`Invalid case ${id}: canvasProfile must be feed_compat|feed_app_direct`);
    }

    const canvasStyle = row.canvasStyle;
    if (
      canvasStyle !== undefined &&
      (typeof canvasStyle !== "string" || !VALID_CANVAS_STYLES.has(canvasStyle as CanvasStyle))
    ) {
      throw new Error(`Invalid case ${id}: canvasStyle must be gallery_clean|polaroid_classic`);
    }

    const whiteCanvas = row.whiteCanvas;
    if (whiteCanvas !== undefined && typeof whiteCanvas !== "boolean") {
      throw new Error(`Invalid case ${id}: whiteCanvas must be boolean`);
    }

    return {
      id,
      file: isAbsolute(file) ? file : resolve(baseDir, file),
      out: isAbsolute(out) ? out : resolve(baseDir, out),
      mode: mode as Mode,
      surface: surface as Surface,
      workflow: workflow as Workflow | undefined,
      whiteCanvas: whiteCanvas as boolean | undefined,
      canvasProfile: canvasProfile as CanvasProfile | undefined,
      canvasStyle: canvasStyle as CanvasStyle | undefined,
    };
  });
}

export function validateMatrix(input: ValidateMatrixInput): ValidateMatrixOutput {
  const startedAt = Date.now();
  const allCases = parseCases(input.casesFile);
  const onlyIdSet = input.onlyIds ? new Set(input.onlyIds) : null;
  const cases = onlyIdSet ? allCases.filter((testCase) => onlyIdSet.has(testCase.id)) : allCases;
  const results: ValidateMatrixOutput["results"] = [];
  let succeeded = 0;
  let failed = 0;

  for (const testCase of cases) {
    const caseStartedAt = Date.now();
    try {
      const benchmarkResult = benchmark({
        file: testCase.file,
        out: testCase.out,
        mode: testCase.mode,
        surface: testCase.surface,
        workflow: testCase.workflow ?? "unknown",
        whiteCanvas: testCase.whiteCanvas,
        canvasProfile: testCase.canvasProfile,
        canvasStyle: testCase.canvasStyle,
      });

      succeeded += 1;
      results.push({
        id: testCase.id,
        status: "ok",
        duration_ms: Date.now() - caseStartedAt,
        benchmark: benchmarkResult,
        error: null,
      });
    } catch (error) {
      failed += 1;
      results.push({
        id: testCase.id,
        status: "error",
        duration_ms: Date.now() - caseStartedAt,
        benchmark: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const okBenchmarks = results.reduce<NonNullable<ValidateMatrixOutput["results"][number]["benchmark"]>[]>(
    (acc, row) => {
      if (row.status === "ok" && row.benchmark !== null) {
        acc.push(row.benchmark);
      }
      return acc;
    },
    [],
  );

  const gradeCounts: ValidateMatrixOutput["summary"]["grade_counts"] = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
  };
  const confidenceCounts: ValidateMatrixOutput["summary"]["confidence_counts"] = {
    low: 0,
    medium: 0,
    high: 0,
  };

  let totalScore = 0;
  let totalConfidence = 0;
  for (const bench of okBenchmarks) {
    totalScore += bench.score.total;
    totalConfidence += bench.confidence.value;
    gradeCounts[bench.score.grade] += 1;
    confidenceCounts[bench.confidence.label] += 1;
  }

  const avgTotalScore =
    okBenchmarks.length > 0
      ? Number.parseFloat((totalScore / okBenchmarks.length).toFixed(3))
      : null;
  const avgConfidence =
    okBenchmarks.length > 0
      ? Number.parseFloat((totalConfidence / okBenchmarks.length).toFixed(3))
      : null;

  return {
    matrix_version: "v1",
    duration_ms: Date.now() - startedAt,
    cases_total: cases.length,
    cases_succeeded: succeeded,
    cases_failed: failed,
    summary: {
      avg_total_score: avgTotalScore,
      avg_confidence: avgConfidence,
      grade_counts: gradeCounts,
      confidence_counts: confidenceCounts,
    },
    results,
  };
}
