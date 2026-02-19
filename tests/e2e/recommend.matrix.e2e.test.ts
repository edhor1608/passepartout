import { describe, expect, test } from "bun:test";
import { parseJsonStdout, runRecommendCli } from "../helpers/cli";

const modes = ["reliable", "experimental"] as const;
const surfaces = ["feed", "story", "reel"] as const;
const orientations = ["portrait", "square", "landscape"] as const;
const workflows = ["app_direct", "api_scheduler", "unknown"] as const;

describe("e2e matrix", () => {
  for (const mode of modes) {
    for (const surface of surfaces) {
      for (const orientation of orientations) {
        for (const workflow of workflows) {
          test(`${mode} | ${surface} | ${orientation} | ${workflow}`, async () => {
            const result = await runRecommendCli([
              "--mode",
              mode,
              "--surface",
              surface,
              "--orientation",
              orientation,
              "--workflow",
              workflow,
              "--json",
            ]);

            expect(result.exitCode).toBe(0);
            const payload = parseJsonStdout(result.stdout);
            expect(payload.selected_mode).toBe(mode);
            expect(String(payload.risk_level)).toMatch(/^(low|medium|high)$/);
            expect(typeof payload.target_resolution).toBe("string");
            expect(String(payload.target_resolution)).toMatch(/^\d+x\d+$/);

            if (surface !== "feed") {
              expect(payload.white_canvas).toEqual({
                contain_only: false,
                enabled: false,
                margins: null,
                no_crop: false,
                profile: null,
              });
            }
          });
        }
      }
    }
  }
});
