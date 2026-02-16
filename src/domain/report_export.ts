import type {
  AnalyzeOutput,
  ReportExportInput,
  ReportExportOutput,
  Resolution,
} from "../types/contracts";
import { analyze } from "./analyze";
import { computeObjectiveMetrics } from "./objective_metrics";
import { exportImage } from "./export_image";
import { exportVideo } from "./export_video";

function toResolution(width: number, height: number): Resolution {
  return `${width}x${height}` as Resolution;
}

function buildComparison(params: {
  inputAnalyze: AnalyzeOutput;
  outputAnalyze: AnalyzeOutput;
  targetResolution: Resolution;
  inputPath: string;
  outputPath: string;
}): ReportExportOutput["comparison"] {
  const { inputAnalyze, outputAnalyze, targetResolution, inputPath, outputPath } = params;
  const inputResolution = toResolution(inputAnalyze.input.width, inputAnalyze.input.height);
  const outputResolution = toResolution(outputAnalyze.input.width, outputAnalyze.input.height);
  const outputMatchesTarget = outputResolution === targetResolution;
  const objectiveMetrics = computeObjectiveMetrics(inputPath, outputPath);

  const inputBitrate = inputAnalyze.input.bitrate_kbps;
  const outputBitrate = outputAnalyze.input.bitrate_kbps;
  const bitrateDeltaKbps =
    inputBitrate !== null && outputBitrate !== null ? outputBitrate - inputBitrate : null;

  const notes: string[] = [];
  if (!outputMatchesTarget) {
    notes.push(`Output resolution ${outputResolution} differs from target ${targetResolution}.`);
  }
  if (bitrateDeltaKbps !== null) {
    notes.push(`Bitrate delta is ${bitrateDeltaKbps} kbps.`);
  }
  if (objectiveMetrics.note) {
    notes.push(objectiveMetrics.note);
  }

  return {
    input_resolution: inputResolution,
    output_resolution: outputResolution,
    target_resolution: targetResolution,
    output_matches_target: outputMatchesTarget,
    input_bitrate_kbps: inputBitrate,
    output_bitrate_kbps: outputBitrate,
    bitrate_delta_kbps: bitrateDeltaKbps,
    input_colorspace: inputAnalyze.input.colorspace,
    output_colorspace: outputAnalyze.input.colorspace,
    input_has_audio: inputAnalyze.input.has_audio,
    output_has_audio: outputAnalyze.input.has_audio,
    psnr_db: objectiveMetrics.psnrDb,
    ssim: objectiveMetrics.ssim,
    notes,
  };
}

export function buildReportExport(input: ReportExportInput): ReportExportOutput {
  const workflow = input.workflow ?? "unknown";

  const inputAnalyze = analyze({
    file: input.file,
    mode: input.mode,
    surface: input.surface,
    workflow,
    whiteCanvas: input.whiteCanvas,
    canvasProfile: input.canvasProfile,
    canvasStyle: input.canvasStyle,
  });

  const exportResult =
    inputAnalyze.input.codec === null
      ? exportImage({
          file: input.file,
          out: input.out,
          mode: input.mode,
          surface: input.surface,
          workflow,
          whiteCanvas: input.whiteCanvas,
          canvasProfile: input.canvasProfile,
          canvasStyle: input.canvasStyle,
        })
      : exportVideo({
          file: input.file,
          out: input.out,
          mode: input.mode,
          surface: input.surface,
          workflow,
          whiteCanvas: input.whiteCanvas,
          canvasProfile: input.canvasProfile,
          canvasStyle: input.canvasStyle,
        });

  const outputAnalyze = analyze({
    file: input.out,
    mode: input.mode,
    surface: input.surface,
    workflow,
  });

  const comparison = buildComparison({
    inputAnalyze,
    outputAnalyze,
    targetResolution: exportResult.target_resolution,
    inputPath: input.file,
    outputPath: input.out,
  });

  return {
    input_analyze: inputAnalyze,
    export: exportResult,
    output_analyze: outputAnalyze,
    comparison,
  };
}
