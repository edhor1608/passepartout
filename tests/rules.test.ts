import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DEFAULT_RULESET_PATH, loadRuleset } from "../src/domain/rules";

describe("ruleset loading", () => {
  test("loads default ruleset from module-relative path", () => {
    const ruleset = loadRuleset();
    expect(DEFAULT_RULESET_PATH.endsWith("config/ruleset.v1.json")).toBe(true);
    expect(ruleset.version).toBe("1.0.0");
  });

  test("throws clear error for invalid ruleset shape", () => {
    const dir = mkdtempSync(join(tmpdir(), "passepartout-rules-"));
    const file = join(dir, "broken.json");
    writeFileSync(file, JSON.stringify({ version: "1.0.0" }), "utf8");

    expect(() => loadRuleset(file)).toThrow(`Invalid ruleset at ${file}: missing required top-level keys`);
  });
});
