import type { CanvasProfile, Margins, Ruleset, Workflow } from "../types/contracts";

type MarginInput = {
  canvasWidth: number;
  canvasHeight: number;
  sourceRatio: number;
};

export function computeMarginsV1({ canvasWidth, canvasHeight, sourceRatio }: MarginInput): Margins {
  if (sourceRatio <= 1.0) {
    const base = Math.round(0.05 * Math.min(canvasWidth, canvasHeight));
    return { left: base, top: base, right: base, bottom: base };
  }

  return {
    left: Math.round(0.04 * canvasWidth),
    top: Math.round(0.16 * canvasHeight),
    right: Math.round(0.04 * canvasWidth),
    bottom: Math.round(0.16 * canvasHeight),
  };
}

type ResolveCanvasProfileInput = {
  requestedProfile?: CanvasProfile;
  workflow: Workflow;
  ruleset: Ruleset;
};

export function resolveCanvasProfile({
  requestedProfile,
  workflow,
  ruleset,
}: ResolveCanvasProfileInput): { profile: CanvasProfile; workflowNote: string } {
  const selected = requestedProfile ?? "feed_compat";
  const requiresAppDirect = ruleset.white_canvas.app_direct_only_profiles.includes(selected);

  if (requiresAppDirect && workflow !== "app_direct") {
    return {
      profile: "feed_compat",
      workflowNote:
        "Requested feed_app_direct is app_direct-only; fallback to feed_compat for deterministic compatibility.",
    };
  }

  if (selected === "feed_compat") {
    return {
      profile: selected,
      workflowNote: "Using feed_compat white-canvas profile.",
    };
  }

  return {
    profile: selected,
    workflowNote: "Using feed_app_direct white-canvas profile for app_direct workflow.",
  };
}
