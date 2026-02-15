import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { recommend } from "../../src/domain/recommend";
import { parseResolution } from "../../src/domain/rules";
import { orientationFromSize, readPpmMeta } from "../helpers/ppm";
import { renderLayoutAscii } from "../helpers/visual";

const imageDir = join(import.meta.dir, "..", "fixtures", "images");
const snapshotDir = join(import.meta.dir, "..", "fixtures", "visual", "snapshots");

const imageFiles = readdirSync(imageDir).filter((name) => name.endsWith(".ppm"));

describe("visual layout snapshots (ascii)", () => {
  for (const imageFile of imageFiles) {
    const base = basename(imageFile, ".ppm");

    for (const scenario of [
      { suffix: "compat", workflow: "unknown" as const, canvasProfile: "feed_compat" as const },
      { suffix: "app_direct", workflow: "app_direct" as const, canvasProfile: "feed_app_direct" as const },
      {
        suffix: "classic",
        workflow: "unknown" as const,
        canvasProfile: "feed_compat" as const,
        canvasStyle: "polaroid_classic" as const,
      },
    ]) {
      test(`${base}.${scenario.suffix}`, () => {
        const meta = readPpmMeta(join(imageDir, imageFile));
        const orientation = orientationFromSize(meta.width, meta.height);

        const rec = recommend({
          mode: "reliable",
          surface: "feed",
          orientation,
          workflow: scenario.workflow,
          whiteCanvas: true,
          canvasProfile: scenario.canvasProfile,
          canvasStyle: scenario.canvasStyle,
          sourceRatio: meta.width / meta.height,
        });

        expect(rec.white_canvas.margins).not.toBeNull();
        const margins = rec.white_canvas.margins;
        if (!margins) {
          throw new Error("margins missing");
        }

        const { width, height } = parseResolution(rec.target_resolution);
        const ascii = renderLayoutAscii({ canvasWidth: width, canvasHeight: height, margins });

        const expected = readFileSync(join(snapshotDir, `${base}.${scenario.suffix}.txt`), "utf8").trimEnd();
        expect(ascii).toBe(expected);
      });
    }
  }
});
