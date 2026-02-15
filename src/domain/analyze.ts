import type { AnalyzeInput, AnalyzeOutput } from "../types/contracts";
import { inspectMedia } from "./media_inspector";
import { recommend } from "./recommend";
import { classifyTier } from "./tier";

export function analyze(input: AnalyzeInput): AnalyzeOutput {
  const media = inspectMedia(input.file);
  const workflow = input.workflow ?? "unknown";

  const recommendation = recommend({
    mode: input.mode,
    surface: input.surface,
    orientation: media.orientation,
    workflow,
    whiteCanvas: input.whiteCanvas,
    canvasProfile: input.canvasProfile,
    canvasStyle: input.canvasStyle,
    sourceRatio: media.width / media.height,
  });

  const tier = classifyTier({
    width: media.width,
    height: media.height,
    surface: input.surface,
  });

  return {
    input: media,
    selection: {
      mode: input.mode,
      surface: input.surface,
      workflow,
      profile: recommendation.selected_profile,
      target_resolution: recommendation.target_resolution,
    },
    tier,
    white_canvas: recommendation.white_canvas,
  };
}
