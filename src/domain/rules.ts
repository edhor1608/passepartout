import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  Mode,
  Orientation,
  ProfileRule,
  Resolution,
  Ruleset,
  Surface,
} from "../types/contracts";

export const DEFAULT_RULESET_PATH = join(process.cwd(), "config", "ruleset.v1.json");

export function loadRuleset(path = DEFAULT_RULESET_PATH): Ruleset {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as Ruleset;
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
