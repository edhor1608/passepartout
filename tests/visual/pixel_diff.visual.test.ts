import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { recommend } from "../../src/domain/recommend";
import { parseResolution } from "../../src/domain/rules";
import type { RgbImage } from "../helpers/image";
import { readP3Image, renderContainCanvas } from "../helpers/image";
import { orientationFromSize } from "../helpers/ppm";
import { pixelScenarios } from "../fixtures/pixel/scenarios";

const imageDir = join(import.meta.dir, "..", "fixtures", "images");
const imageFiles = readdirSync(imageDir).filter((name) => name.endsWith(".ppm"));

function rgbAt(image: RgbImage, x: number, y: number): [number, number, number] {
  const i = (y * image.width + x) * 3;
  return [image.pixels[i] ?? 0, image.pixels[i + 1] ?? 0, image.pixels[i + 2] ?? 0];
}

function nonWhitePixelCount(image: RgbImage): number {
  let count = 0;
  for (let i = 0; i < image.pixels.length; i += 3) {
    if (image.pixels[i] !== 255 || image.pixels[i + 1] !== 255 || image.pixels[i + 2] !== 255) {
      count += 1;
    }
  }
  return count;
}

describe("pixel-level visual regression", () => {
  for (const imageFile of imageFiles) {
    const source = readP3Image(join(imageDir, imageFile));
    const orientation = orientationFromSize(source.width, source.height);
    const base = basename(imageFile, ".ppm");

    for (const scenario of pixelScenarios) {
      test(`${base}.${scenario.suffix}`, () => {
        const rec = recommend({
          mode: "reliable",
          surface: "feed",
          orientation,
          workflow: scenario.workflow,
          whiteCanvas: true,
          canvasProfile: scenario.canvasProfile,
          canvasStyle: "canvasStyle" in scenario ? scenario.canvasStyle : undefined,
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

        expect(actual.width).toBe(width);
        expect(actual.height).toBe(height);
        expect(rgbAt(actual, 0, 0)).toEqual([255, 255, 255]);
        expect(rgbAt(actual, actual.width - 1, actual.height - 1)).toEqual([255, 255, 255]);
        expect(nonWhitePixelCount(actual)).toBeGreaterThan(0);
      });
    }
  }
});
