import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseJsonStdout, runOverlayCli } from "../helpers/cli";

const outDir = join(import.meta.dir, "..", "fixtures", "exports");

function resetOut(name: string): string {
  mkdirSync(outDir, { recursive: true });
  const output = join(outDir, name);
  rmSync(output, { force: true });
  return output;
}

describe("overlay cli integration", () => {
  test("returns deterministic json for 4:5 ratio", async () => {
    const result = await runOverlayCli(["--ratio", "4:5", "--json"]);

    expect(result.exitCode).toBe(0);
    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("ratio", "4:5");
    expect(payload).toHaveProperty("canvas_resolution", "1080x1350");
    expect(payload).toHaveProperty("safe_zone");
    expect(payload).toHaveProperty("thirds");
  });

  test("writes svg file when --out is provided", async () => {
    const output = resetOut("overlay_3_4.svg");
    const result = await runOverlayCli([
      "--ratio",
      "3:4",
      "--out",
      output,
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    expect(existsSync(output)).toBe(true);
    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("ratio", "3:4");
    expect(payload).toHaveProperty("output_svg_path");

    const svg = readFileSync(output, "utf8");
    expect(svg).toContain("viewBox=\"0 0 1080 1440\"");
    expect(svg).toContain("id=\"safe-zone\"");
  });
});
