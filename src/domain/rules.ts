import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type {
  CanvasProfile,
  CanvasStyle,
  Mode,
  Orientation,
  ProfileRule,
  RiskLevel,
  Resolution,
  Ruleset,
  Surface,
} from "../types/contracts";

export const DEFAULT_RULESET_PATH = fileURLToPath(new URL("../../config/ruleset.v1.json", import.meta.url));

const MODES = ["reliable", "experimental"] as const satisfies readonly Mode[];
const ORIENTATIONS = ["portrait", "square", "landscape"] as const satisfies readonly Orientation[];
const CANVAS_PROFILES = ["feed_compat", "feed_app_direct"] as const satisfies readonly CanvasProfile[];
const CANVAS_STYLES = ["gallery_clean", "polaroid_classic"] as const satisfies readonly CanvasStyle[];
const RISK_LEVELS = ["low", "medium", "high"] as const satisfies readonly RiskLevel[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function isResolution(value: unknown): value is Resolution {
  return typeof value === "string" && /^[0-9]+x[0-9]+$/.test(value);
}

function fail(path: string, message: string): never {
  throw new Error(`Invalid ruleset at ${path}: ${message}`);
}

function readRecord(value: unknown, path: string, key: string): Record<string, unknown> {
  if (!isRecord(value)) {
    fail(path, `${key} must be an object`);
  }
  return value;
}

function validateProfileRule(value: unknown, path: string, key: string): void {
  const rule = readRecord(value, path, key);
  if (!isResolution(rule.resolution)) {
    fail(path, `${key}.resolution must be NxN`);
  }
  if (typeof rule.profile !== "string" || rule.profile.length === 0) {
    fail(path, `${key}.profile must be a non-empty string`);
  }
  if (typeof rule.reason !== "string" || rule.reason.length === 0) {
    fail(path, `${key}.reason must be a non-empty string`);
  }
  if (!isOneOf(rule.risk_level, RISK_LEVELS)) {
    fail(path, `${key}.risk_level must be low, medium, or high`);
  }
}

function validateRuleset(parsed: unknown, path: string): void {
  if (!isRecord(parsed) || !isRecord(parsed.profiles) || !isRecord(parsed.white_canvas)) {
    fail(path, "missing required top-level keys");
  }
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    fail(path, "version must be a non-empty string");
  }

  for (const mode of MODES) {
    const modeRules = readRecord(parsed.profiles[mode], path, `profiles.${mode}`);
    const feedRules = readRecord(modeRules.feed, path, `profiles.${mode}.feed`);
    for (const orientation of ORIENTATIONS) {
      validateProfileRule(feedRules[orientation], path, `profiles.${mode}.feed.${orientation}`);
    }
    validateProfileRule(modeRules.story, path, `profiles.${mode}.story`);
    validateProfileRule(modeRules.reel, path, `profiles.${mode}.reel`);
  }

  const whiteCanvas = parsed.white_canvas;
  const whiteProfiles = readRecord(whiteCanvas.profiles, path, "white_canvas.profiles");
  for (const profile of CANVAS_PROFILES) {
    const config = readRecord(whiteProfiles[profile], path, `white_canvas.profiles.${profile}`);
    if (!isResolution(config.resolution)) {
      fail(path, `white_canvas.profiles.${profile}.resolution must be NxN`);
    }
  }
  if (
    !Array.isArray(whiteCanvas.app_direct_only_profiles) ||
    !whiteCanvas.app_direct_only_profiles.every((profile) => isOneOf(profile, CANVAS_PROFILES))
  ) {
    fail(path, "white_canvas.app_direct_only_profiles must contain known canvas profiles");
  }
  if (!isOneOf(whiteCanvas.default_style, CANVAS_STYLES)) {
    fail(path, "white_canvas.default_style must be a known canvas style");
  }
  const styles = readRecord(whiteCanvas.styles, path, "white_canvas.styles");
  for (const style of CANVAS_STYLES) {
    const config = readRecord(styles[style], path, `white_canvas.styles.${style}`);
    if (typeof config.extra_bottom_ratio !== "number" || !Number.isFinite(config.extra_bottom_ratio)) {
      fail(path, `white_canvas.styles.${style}.extra_bottom_ratio must be a finite number`);
    }
  }
}

export function loadRuleset(path = DEFAULT_RULESET_PATH): Ruleset {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  validateRuleset(parsed, path);
  return parsed as Ruleset;
}

export function parseResolution(resolution: Resolution): { width: number; height: number } {
  const [wText, hText] = resolution.split("x");
  const w = Number.parseInt(wText ?? "", 10);
  const h = Number.parseInt(hText ?? "", 10);
  if (!Number.isFinite(w) || !Number.isFinite(h)) {
    throw new Error(`invalid resolution: ${resolution}`);
  }
  return { width: w, height: h };
}

export function selectProfileRule(
  ruleset: Ruleset,
  mode: Mode,
  surface: Surface,
  orientation: Orientation,
): ProfileRule {
  if (surface === "feed") {
    return ruleset.profiles[mode].feed[orientation];
  }
  return ruleset.profiles[mode][surface];
}
