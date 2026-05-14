import { describe, expect, test } from "bun:test";
import { computePrepareImageLayout } from "../src/domain/prepare_image_layout";

describe("prepare image layout", () => {
  test("landscape uses 2160x1440 with equal border and centered cover crop", () => {
    const layout = computePrepareImageLayout({
      borderPx: 165,
      sourceHeight: 4330,
      sourceWidth: 6494,
    });

    expect(layout).toEqual({
      effectiveBorderPx: 165,
      innerHeight: 1110,
      innerWidth: 1830,
      outputHeight: 1440,
      outputWidth: 2160,
      renderHeight: 1110,
      renderOffsetX: 165,
      renderOffsetY: 165,
      renderWidth: 1830,
      sourceCrop: { height: 3939, width: 6494, x: 0, y: 196 },
      variant: "landscape",
    });
  });

  test("portrait contains the full image inside the minimum border", () => {
    const layout = computePrepareImageLayout({
      borderPx: 165,
      sourceHeight: 1920,
      sourceWidth: 1440,
    });

    expect(layout).toMatchObject({
      effectiveBorderPx: 165,
      outputHeight: 1920,
      outputWidth: 1440,
      renderHeight: 1480,
      renderOffsetX: 165,
      renderOffsetY: 220,
      renderWidth: 1110,
      variant: "portrait",
    });
    expect(layout.sourceCrop).toBeUndefined();
  });

  test("small landscape shrinks without upscaling and scales the border", () => {
    const layout = computePrepareImageLayout({
      borderPx: 165,
      sourceHeight: 600,
      sourceWidth: 1000,
    });

    expect(layout).toMatchObject({
      effectiveBorderPx: 89,
      innerHeight: 600,
      innerWidth: 989,
      outputHeight: 778,
      outputWidth: 1167,
      renderHeight: 600,
      renderWidth: 989,
      variant: "landscape",
    });
  });

  test("border scales proportionally and rounds to nearest pixel", () => {
    const layout = computePrepareImageLayout({
      borderPx: 165,
      sourceHeight: 554,
      sourceWidth: 914,
    });

    expect(layout).toMatchObject({
      effectiveBorderPx: 83,
      outputHeight: 720,
      outputWidth: 1080,
      variant: "landscape",
    });
  });

  test("square images use portrait output", () => {
    const layout = computePrepareImageLayout({
      borderPx: 165,
      sourceHeight: 1000,
      sourceWidth: 1000,
    });

    expect(layout).toMatchObject({
      effectiveBorderPx: 149,
      outputHeight: 1728,
      outputWidth: 1296,
      renderHeight: 998,
      renderWidth: 998,
      variant: "portrait",
    });
    expect(layout.sourceCrop).toBeUndefined();
  });

  test("0px border is valid", () => {
    const layout = computePrepareImageLayout({
      borderPx: 0,
      sourceHeight: 4330,
      sourceWidth: 6494,
    });

    expect(layout).toMatchObject({
      effectiveBorderPx: 0,
      innerHeight: 1440,
      innerWidth: 2160,
      outputHeight: 1440,
      outputWidth: 2160,
      variant: "landscape",
    });
  });
});
