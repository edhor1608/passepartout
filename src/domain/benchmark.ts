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
  };
}
