import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { recommend } from "../../src/domain/recommend";
import { parseResolution } from "../../src/domain/rules";
import { diffRgb, readP3Image, readP6Image, renderContainCanvas } from "../helpers/image";
import { orientationFromSize } from "../helpers/ppm";

const imageDir = join(import.meta.dir, "..", "fixtures", "images");
const snapshotDir = join(import.meta.dir, "..", "fixtures", "pixel", "snapshots");
const imageFiles = readdirSync(imageDir).filter((name) => name.endsWith(".ppm"));

const scenarios = [
  { suffix: "compat", workflow: "unknown" as const, canvasProfile: "feed_compat" as const },
  { suffix: "app_direct", workflow: "app_direct" as const, canvasProfile: "feed_app_direct" as const },
  {
    suffix: "fallback",
    workflow: "api_scheduler" as const,
    canvasProfile: "feed_app_direct" as const,
  },
  {
    suffix: "classic",
    workflow: "unknown" as const,
    canvasProfile: "feed_compat" as const,
    canvasStyle: "polaroid_classic" as const,
  },
];

describe("pixel-level visual regression", () => {
  for (const imageFile of imageFiles) {
    const source = readP3Image(join(imageDir, imageFile));
    const orientation = orientationFromSize(source.width, source.height);
    const base = basename(imageFile, ".ppm");

    for (const scenario of scenarios) {
      test(`${base}.${scenario.suffix}`, () => {
        const rec = recommend({
          mode: "reliable",
          surface: "feed",
          orientation,
          workflow: scenario.workflow,
          whiteCanvas: true,
          canvasProfile: scenario.canvasProfile,
          canvasStyle: scenario.canvasStyle,
          sourceRatio: source.width / source.height,
        });

        expect(rec.white_canvas.margins).not.toBeNull();
        const margins = rec.white_canvas.margins;
        if (!margins) {
          throw new Error("margins missing");
        }

        const { width, height } = parseResolution(rec.target_resolution);
        const actual = renderContainCanvas({
          source,
          canvasWidth: width,
          canvasHeight: height,
          margins,
        });

        const expected = readP6Image(join(snapshotDir, `${base}.${scenario.suffix}.ppm`));
        const diff = diffRgb(actual, expected);

        expect(actual.width).toBe(expected.width);
        expect(actual.height).toBe(expected.height);
        expect(diff.mismatchPixels, `maxChannelDelta=${diff.maxChannelDelta}, meanDelta=${diff.meanChannelDelta}`).toBe(0);
      });
    }
  }
});
