import type { BenchmarkInput, BenchmarkOutput } from "../types/contracts";
import { buildReportExport } from "./report_export";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function gradeFromScore(total: number): "A" | "B" | "C" | "D" {
  if (total >= 85) {
    return "A";
  }
  if (total >= 70) {
    return "B";
  }
  if (total >= 50) {
    return "C";
  }
  return "D";
}

function confidenceLabel(value: number): "low" | "medium" | "high" {
  if (value >= 0.8) {
    return "high";
  }
  if (value >= 0.55) {
    return "medium";
  }
  return "low";
}

function computeConfidence(reportExport: BenchmarkOutput["report_export"]): BenchmarkOutput["confidence"] {
  let score = 0;
  if (reportExport.comparison.output_matches_target) {
    score += 0.35;
  }
  if (reportExport.comparison.bitrate_delta_kbps !== null) {
    score += 0.2;
  }
  if (reportExport.comparison.psnr_db !== null) {
    score += 0.2;
  }
  if (reportExport.comparison.ssim !== null) {
    score += 0.2;
  }
  if (reportExport.output_analyze.input.codec !== null) {
    score += 0.05;
  }

  const value = Number.parseFloat(clamp(score, 0, 1).toFixed(3));
  return {
    value,
    label: confidenceLabel(value),
  };
}

export function benchmark(input: BenchmarkInput): BenchmarkOutput {
  const reportExport = buildReportExport(input);

  const resolutionScore = reportExport.comparison.output_matches_target ? 50 : 0;

  const inputBitrate = reportExport.comparison.input_bitrate_kbps;
  const deltaBitrate = reportExport.comparison.bitrate_delta_kbps;
  const bitrateScore =
    inputBitrate !== null && inputBitrate > 0 && deltaBitrate !== null
      ? clamp(40 - Math.round((Math.abs(deltaBitrate) / inputBitrate) * 40), 0, 40)
      : 20;

  const outputCodec = reportExport.output_analyze.input.codec;
  const codecScore = outputCodec === null || outputCodec === "h264" ? 10 : 0;

  const total = clamp(resolutionScore + bitrateScore + codecScore, 0, 100);

  return {
    benchmark_version: "v1",
    report_export: reportExport,
    score: {
      total,
      grade: gradeFromScore(total),
      resolution_score: resolutionScore,
      bitrate_score: bitrateScore,
      codec_score: codecScore,
    },
    confidence: computeConfidence(reportExport),
  };
}
