import { describe, expect, test } from "bun:test";
import {
  computePrepareImageLayout,
  type PrepareImageLayout,
  type PrepareImageVariant,
} from "../src/domain/prepare_image_layout";

// The V1 output shape set and minimum white border rules from CONTEXT.md, checked as
// invariants over many sources instead of pinned example layouts.
const TARGETS = {
  landscape: { maxHeight: 1440, maxWidth: 2160, ratioHeight: 2, ratioWidth: 3 },
  portrait: { maxHeight: 1920, maxWidth: 1440, ratioHeight: 4, ratioWidth: 3 },
} as const satisfies Record<
  PrepareImageVariant,
  { maxHeight: number; maxWidth: number; ratioHeight: number; ratioWidth: number }
>;

type Source = { sourceWidth: number; sourceHeight: number; borderPx: number };

function buildSources(): Source[] {
  const sizes = [1, 2, 3, 5, 17, 40, 99, 100, 333, 600, 914, 1000, 1110, 1440, 2160, 4330, 6494];
  const borders = [0, 1, 57, 165, 400, 720, 1000];
  const sources: Source[] = [];
  for (const sourceWidth of sizes) {
    for (const sourceHeight of sizes) {
      for (const borderPx of borders) sources.push({ borderPx, sourceHeight, sourceWidth });
    }
  }
  return sources;
}

function expectedBorder(borderPx: number, outputWidth: number, maxWidth: number): number {
  return borderPx === 0 ? 0 : Math.max(1, Math.round(borderPx * (outputWidth / maxWidth)));
}

function upscalesInto(
  source: Source,
  innerWidth: number,
  innerHeight: number,
  variant: PrepareImageVariant,
): boolean {
  if (variant === "landscape") {
    return innerWidth > source.sourceWidth || innerHeight > source.sourceHeight;
  }
  return innerWidth > source.sourceWidth && innerHeight > source.sourceHeight;
}

function canvasFits(source: Source, outputWidth: number, variant: PrepareImageVariant): boolean {
  const target = TARGETS[variant];
  const outputHeight = (outputWidth / target.ratioWidth) * target.ratioHeight;
  const border = expectedBorder(source.borderPx, outputWidth, target.maxWidth);
  const innerWidth = outputWidth - 2 * border;
  const innerHeight = outputHeight - 2 * border;
  return (
    outputWidth <= target.maxWidth &&
    innerWidth > 0 &&
    innerHeight > 0 &&
    !upscalesInto(source, innerWidth, innerHeight, variant)
  );
}

function expectLandscape(source: Source, layout: PrepareImageLayout): void {
  const border = layout.effectiveBorderPx;
  expect(layout).toMatchObject({
    innerHeight: layout.outputHeight - 2 * border,
    innerWidth: layout.outputWidth - 2 * border,
    renderHeight: layout.outputHeight - 2 * border,
    renderOffsetX: border,
    renderOffsetY: border,
    renderWidth: layout.outputWidth - 2 * border,
  });

  const crop = layout.sourceCrop;
  if (crop === undefined) throw new Error("landscape layout must crop the source");
  expect(crop.width === source.sourceWidth || crop.height === source.sourceHeight).toBe(true);
  expect(crop.x).toBe(Math.round((source.sourceWidth - crop.width) / 2));
  expect(crop.y).toBe(Math.round((source.sourceHeight - crop.height) / 2));
  expect(crop.x + crop.width).toBeLessThanOrEqual(source.sourceWidth);
  expect(crop.y + crop.height).toBeLessThanOrEqual(source.sourceHeight);
  expect(crop.width).toBeGreaterThanOrEqual(layout.renderWidth);
  expect(crop.height).toBeGreaterThanOrEqual(layout.renderHeight);
  const aspectError = Math.abs(crop.width * layout.renderHeight - crop.height * layout.renderWidth);
  expect(aspectError).toBeLessThanOrEqual(Math.max(layout.renderWidth, layout.renderHeight) / 2);
}

function expectPortrait(source: Source, layout: PrepareImageLayout): void {
  const border = layout.effectiveBorderPx;
  expect(layout.sourceCrop).toBeUndefined();
  expect(layout.innerWidth).toBe(layout.outputWidth - 2 * border);
  expect(layout.innerHeight).toBe(layout.outputHeight - 2 * border);

  const { renderHeight, renderWidth } = layout;
  const { sourceHeight, sourceWidth } = source;
  expect(renderWidth).toBeLessThanOrEqual(Math.min(layout.innerWidth, sourceWidth));
  expect(renderHeight).toBeLessThanOrEqual(Math.min(layout.innerHeight, sourceHeight));
  const touchesFrame = renderWidth === layout.innerWidth || renderHeight === layout.innerHeight;
  const keepsSourceSize = renderWidth === sourceWidth && renderHeight === sourceHeight;
  expect(touchesFrame || keepsSourceSize).toBe(true);
  const aspectError = Math.abs(renderWidth * sourceHeight - renderHeight * sourceWidth);
  expect(aspectError).toBeLessThanOrEqual((sourceWidth + sourceHeight) / 2);
  expect(layout.renderOffsetX).toBe(Math.round((layout.outputWidth - layout.renderWidth) / 2));
  expect(layout.renderOffsetY).toBe(Math.round((layout.outputHeight - layout.renderHeight) / 2));
  expect(layout.renderOffsetX).toBeGreaterThanOrEqual(border);
  expect(layout.renderOffsetY).toBeGreaterThanOrEqual(border);
}

describe("prepare image layout model", () => {
  test("every source gets the largest same-ratio canvas without upscaling", () => {
    for (const source of buildSources()) {
      const variant = source.sourceWidth > source.sourceHeight ? "landscape" : "portrait";
      const target = TARGETS[variant];
      const largest = Array.from(
        { length: target.maxWidth / target.ratioWidth },
        (_, step) => target.maxWidth - step * target.ratioWidth,
      ).find((width) => canvasFits(source, width, variant));

      if (largest === undefined) {
        expect(() => computePrepareImageLayout(source)).toThrow("too small");
        continue;
      }

      const layout = computePrepareImageLayout(source);
      expect(layout.variant).toBe(variant);
      expect(layout.outputWidth).toBe(largest);
      expect(layout.outputHeight).toBe((largest / target.ratioWidth) * target.ratioHeight);
      expect(layout.effectiveBorderPx).toBe(
        expectedBorder(source.borderPx, largest, target.maxWidth),
      );
      if (variant === "landscape") expectLandscape(source, layout);
      else expectPortrait(source, layout);
    }
  });

  test("rejects non-integer, zero, and negative inputs", () => {
    const invalid: Source[] = [
      { borderPx: 57, sourceHeight: 100, sourceWidth: 0 },
      { borderPx: 57, sourceHeight: 0, sourceWidth: 100 },
      { borderPx: 57, sourceHeight: 100, sourceWidth: 1.5 },
      { borderPx: 57, sourceHeight: 1.5, sourceWidth: 100 },
      { borderPx: -1, sourceHeight: 100, sourceWidth: 100 },
      { borderPx: 1.5, sourceHeight: 100, sourceWidth: 100 },
    ];
    for (const source of invalid) {
      expect(() => computePrepareImageLayout(source)).toThrow("integer");
    }
  });
});
