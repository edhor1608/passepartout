import type { Surface, TierOutput } from "../types/contracts";

type TierInput = {
  width: number;
  height: number;
  surface: Surface;
};

type RatioBounds = {
  min: number;
  max: number;
};

const FEED_BOUNDS: RatioBounds = { min: 4 / 5, max: 1.91 };
const VERTICAL_BOUNDS: RatioBounds = { min: 9 / 16, max: 1.91 };

function boundsForSurface(surface: Surface): RatioBounds {
  return surface === "feed" ? FEED_BOUNDS : VERTICAL_BOUNDS;
}

function isAspectSupported(ratio: number, surface: Surface): boolean {
  const { min, max } = boundsForSurface(surface);
  return ratio >= min && ratio <= max;
}

export function classifyTier({ width, height, surface }: TierInput): TierOutput {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {
      name: "tier_aspect_correction",
      reason: "Invalid dimensions: width and height must be positive.",
      risk_level: "high",
    };
  }

  const ratio = width / height;

  if (!isAspectSupported(ratio, surface)) {
    return {
      name: "tier_aspect_correction",
      reason: `Aspect ratio ${ratio.toFixed(4)} is outside supported ${surface} bounds.`,
      risk_level: "medium",
    };
  }

  if (width < 320) {
    return {
      name: "tier_upscale",
      reason: "Input width is below 320 and may be upscaled by Instagram.",
      risk_level: "high",
    };
  }

  if (width > 1080) {
    return {
      name: "tier_downscale",
      reason: "Input width is above 1080 and likely to be downscaled.",
      risk_level: "medium",
    };
  }

  return {
    name: "tier_preserve",
    reason: "Input width is within 320..1080 and aspect is supported.",
    risk_level: "low",
  };
}
