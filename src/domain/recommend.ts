import type {
  Orientation,
  RecommendInput,
  RecommendationOutput,
  Resolution,
  Ruleset,
  WhiteCanvasOutput,
} from "../types/contracts";
import { loadRuleset, parseResolution, selectProfileRule } from "./rules";
import { computeStyledMargins, resolveCanvasProfile, resolveCanvasStyle } from "./white_canvas";

const DEFAULT_RULESET = loadRuleset();

function sourceRatioFromOrientation(orientation: Orientation): number {
  if (orientation === "landscape") {
    return 1.5;
  }
  if (orientation === "square") {
    return 1.0;
  }
  return 0.8;
}

function disabledWhiteCanvas(): WhiteCanvasOutput {
  return {
    enabled: false,
    profile: null,
    style: null,
    margins: null,
    contain_only: false,
    no_crop: false,
  };
}

export function recommend(input: RecommendInput, ruleset: Ruleset = DEFAULT_RULESET): RecommendationOutput {
  const workflow = input.workflow ?? "unknown";
  const whiteCanvasEnabled = input.whiteCanvas ?? false;
  const base = selectProfileRule(ruleset, input.mode, input.surface, input.orientation);

  let selectedProfile = base.profile;
  let targetResolution: Resolution = base.resolution;
  let reason = base.reason;
  let riskLevel = base.risk_level;
  let workflowNote = `Workflow set to ${workflow}.`;
  let whiteCanvas = disabledWhiteCanvas();

  if (whiteCanvasEnabled) {
    if (input.surface === "feed") {
      const resolved = resolveCanvasProfile({
        requestedProfile: input.canvasProfile,
        workflow,
        ruleset,
      });
      const canvasResolution = ruleset.white_canvas.profiles[resolved.profile].resolution;
      const { width, height } = parseResolution(canvasResolution);
      const sourceRatio = input.sourceRatio ?? sourceRatioFromOrientation(input.orientation);
      const style = resolveCanvasStyle(input.canvasStyle, ruleset);

      selectedProfile = `${input.mode}_feed_white_canvas_${resolved.profile}`;
      targetResolution = canvasResolution;
      reason = `White-canvas contain profile ${resolved.profile} with style ${style} selected for ${input.orientation} source.`;
      riskLevel = input.mode === "experimental" ? "medium" : "low";
      workflowNote = resolved.workflowNote;
      whiteCanvas = {
        enabled: true,
        profile: resolved.profile,
        style,
        margins: computeStyledMargins({
          canvasWidth: width,
          canvasHeight: height,
          sourceRatio,
          style,
          ruleset,
        }),
        contain_only: true,
        no_crop: true,
      };
    } else {
      const { width, height } = parseResolution(base.resolution);
      const sourceRatio = input.sourceRatio ?? sourceRatioFromOrientation(input.orientation);
      const style = resolveCanvasStyle(input.canvasStyle, ruleset);
      const surfaceProfile = input.surface === "story" ? "story_default" : "reel_default";

      selectedProfile = `${input.mode}_${input.surface}_white_canvas_${surfaceProfile}`;
      targetResolution = base.resolution;
      reason = `White-canvas contain profile ${surfaceProfile} with style ${style} selected for ${input.orientation} source.`;
      riskLevel = input.mode === "experimental" ? "high" : "low";
      workflowNote = `Using ${surfaceProfile} white-canvas profile.`;
      if (input.canvasProfile) {
        workflowNote += " Feed canvas-profile options are ignored for non-feed surfaces.";
      }

      whiteCanvas = {
        enabled: true,
        profile: surfaceProfile,
        style,
        margins: computeStyledMargins({
          canvasWidth: width,
          canvasHeight: height,
          sourceRatio,
          style,
          ruleset,
        }),
        contain_only: true,
        no_crop: true,
      };
    }
  }

  return {
    selected_mode: input.mode,
    selected_profile: selectedProfile,
    target_resolution: targetResolution,
    reason,
    risk_level: riskLevel,
    workflow_note: workflowNote,
    white_canvas: whiteCanvas,
  };
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, sortKeysDeep(child)]);
    return Object.fromEntries(entries);
  }

  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

export function toStableJson(output: RecommendationOutput): string {
  return stableStringify(output);
}
