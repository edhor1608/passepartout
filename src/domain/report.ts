import type { ReportInput, ReportOutput } from "../types/contracts";
import { analyze } from "./analyze";

export function buildReport(input: ReportInput): ReportOutput {
  const analyzed = analyze(input);

  const checks = [
    analyzed.input.width >= 320
      ? {
          id: "input_width_min",
          label: "Input width baseline",
          status: "pass" as const,
          message: `Input width ${analyzed.input.width}px is within baseline threshold.`,
        }
      : {
          id: "input_width_min",
          label: "Input width baseline",
          status: "warn" as const,
          message: `Input width ${analyzed.input.width}px is below baseline threshold (320px).`,
        },
    analyzed.tier.name === "tier_aspect_correction"
      ? {
          id: "aspect_fit",
          label: "Aspect fit",
          status: "warn" as const,
          message: "Input aspect is outside supported bounds for selected surface.",
        }
      : {
          id: "aspect_fit",
          label: "Aspect fit",
          status: "pass" as const,
          message: "Input aspect is within supported bounds for selected surface.",
        },
    analyzed.input.codec === null
      ? {
          id: "audio_present",
          label: "Audio track",
          status: "pass" as const,
          message: "Still image input: audio track is not applicable.",
        }
      : analyzed.input.has_audio
        ? {
            id: "audio_present",
            label: "Audio track",
            status: "pass" as const,
            message: "Audio track detected in input video.",
          }
        : {
            id: "audio_present",
            label: "Audio track",
            status: "warn" as const,
            message: "No audio track detected in input video.",
          },
    analyzed.input.codec === null || analyzed.input.codec === "h264"
      ? {
          id: "codec_preference",
          label: "Codec preference",
          status: "pass" as const,
          message:
            analyzed.input.codec === null
              ? "Still image input: codec preference is not applicable."
              : "Input codec is h264 and matches baseline preference.",
        }
      : {
          id: "codec_preference",
          label: "Codec preference",
          status: "warn" as const,
          message: `Input codec ${analyzed.input.codec} differs from h264 baseline preference.`,
        },
  ];

  const nextActions = [
    analyzed.input.codec === null
      ? "Use export-image for deterministic still export."
      : "Use export-video for deterministic video export.",
  ];

  if (checks.some((check) => check.status === "warn")) {
    nextActions.push("Review warning checks before upload.");
  }

  if (analyzed.white_canvas.enabled) {
    nextActions.push("Confirm white-canvas margins visually before posting.");
  }

  return {
    analyze: analyzed,
    checks,
    next_actions: nextActions,
  };
}
