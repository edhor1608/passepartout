import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type {
  Mode,
  Orientation,
  ProfileRule,
  Resolution,
  Ruleset,
  Surface,
} from "../types/contracts";

export const DEFAULT_RULESET_PATH = fileURLToPath(new URL("../../config/ruleset.v1.json", import.meta.url));

export function loadRuleset(path = DEFAULT_RULESET_PATH): Ruleset {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("profiles" in parsed) ||
    typeof parsed.profiles !== "object" ||
    parsed.profiles === null ||
    !("white_canvas" in parsed) ||
    typeof parsed.white_canvas !== "object" ||
    parsed.white_canvas === null
  ) {
    throw new Error(`Invalid ruleset at ${path}: missing required top-level keys`);
  }

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
