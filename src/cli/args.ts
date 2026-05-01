import type { CanvasProfile, CanvasStyle, Mode, Orientation, OverlayRatio, Surface, Workflow } from "../types/contracts";

const MODES = ["reliable", "experimental"] as const satisfies readonly Mode[];
const SURFACES = ["feed", "story", "reel"] as const satisfies readonly Surface[];
const ORIENTATIONS = ["portrait", "square", "landscape"] as const satisfies readonly Orientation[];
const WORKFLOWS = ["app_direct", "api_scheduler", "unknown"] as const satisfies readonly Workflow[];
const CANVAS_PROFILES = ["feed_compat", "feed_app_direct"] as const satisfies readonly CanvasProfile[];
const CANVAS_STYLES = ["gallery_clean", "polaroid_classic"] as const satisfies readonly CanvasStyle[];
const OVERLAY_RATIOS = ["4:5", "3:4", "9:16"] as const satisfies readonly OverlayRatio[];

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

function parseOneOf<T extends string>(value: string, allowed: readonly T[], label: string): T {
  if (!isOneOf(value, allowed)) {
    throw new Error(`Invalid ${label}: ${value}. Allowed values: ${allowed.join(", ")}`);
  }
  return value;
}

export function positional(argv: string[], label: string): string {
  const value = argv[0];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing required positional arg: <${label}>`);
  }
  return value;
}

export function flagValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

export function integerFlagValue(argv: string[], index: number, flag: string): number {
  const value = flagValue(argv, index, flag);
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`Invalid ${flag} value`);
  }
  return Number.parseInt(value, 10);
}

export function printHelpIfRequested(argv: string[], usage: string): boolean {
  if (!argv.includes("--help") && !argv.includes("-h")) {
    return false;
  }
  console.log(usage);
  return true;
}

export function parseMode(value: string): Mode {
  return parseOneOf(value, MODES, "mode");
}

export function parseSurface(value: string): Surface {
  return parseOneOf(value, SURFACES, "surface");
}

export function parseOrientation(value: string): Orientation {
  return parseOneOf(value, ORIENTATIONS, "orientation");
}

export function parseWorkflow(value: string): Workflow {
  return parseOneOf(value, WORKFLOWS, "workflow");
}

export function parseCanvasProfile(value: string): CanvasProfile {
  return parseOneOf(value, CANVAS_PROFILES, "canvas profile");
}

export function parseCanvasStyle(value: string): CanvasStyle {
  return parseOneOf(value, CANVAS_STYLES, "canvas style");
}

export function parseOverlayRatio(value: string): OverlayRatio {
  return parseOneOf(value, OVERLAY_RATIOS, "ratio");
}
