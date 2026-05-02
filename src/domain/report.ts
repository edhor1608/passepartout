import { statSync } from "node:fs";
import type { ReportInput, ReportOutput } from "../types/contracts";
import { analyze } from "./analyze";

const API_IMAGE_FILE_LIMIT_BYTES = 8 * 1024 * 1024;

export function buildReport(input: ReportInput): ReportOutput {
  const analyzed = analyze(input);
  const workflow = input.workflow ?? "unknown";
  const fileSizeBytes = statSync(input.file).size;

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
    workflow === "unknown"
      ? {
          id: "upload_workflow",
          label: "Upload workflow",
          status: "warn" as const,
          message: "Upload workflow is unknown; choose app_direct or api_scheduler before final export.",
        }
      : {
          id: "upload_workflow",
          label: "Upload workflow",
          status: "pass" as const,
          message:
            workflow === "api_scheduler"
              ? "API scheduler workflow selected; use conservative feed compatibility rules."
              : "App-direct workflow selected; enable high-quality uploads in Instagram before posting.",
        },
    workflow === "api_scheduler" && analyzed.input.codec === null && fileSizeBytes > API_IMAGE_FILE_LIMIT_BYTES
      ? {
          id: "api_image_file_size",
          label: "API image file size",
          status: "warn" as const,
          message: `Input image is ${fileSizeBytes} bytes, above the 8 MiB API scheduler baseline.`,
        }
      : {
          id: "api_image_file_size",
          label: "API image file size",
          status: "pass" as const,
          message:
            workflow === "api_scheduler" && analyzed.input.codec === null
              ? `Input image is ${fileSizeBytes} bytes, within the 8 MiB API scheduler baseline.`
              : "API image file size check is not applicable for this input/workflow.",
        },
    analyzed.input.colorspace === "unknown"
      ? {
          id: "color_metadata",
          label: "Color metadata",
          status: "warn" as const,
          message: "Input color metadata is unknown; inspect color profile before final upload.",
        }
      : {
          id: "color_metadata",
          label: "Color metadata",
          status: "pass" as const,
          message: `Input color metadata detected as ${analyzed.input.colorspace}.`,
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

  if (workflow === "app_direct") {
    nextActions.push("Enable Instagram high-quality uploads and avoid in-app edits before posting.");
  }

  return {
    analyze: analyzed,
    checks,
    next_actions: nextActions,
  };
}
