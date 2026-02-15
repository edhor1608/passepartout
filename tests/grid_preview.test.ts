import { describe, expect, test } from "bun:test";
import { buildGridPreviewSvg, createGridPreview } from "../src/domain/grid_preview";

describe("grid preview domain", () => {
  test("creates deterministic 4:5 profile-grid crop window", () => {
    const preview = createGridPreview("4:5");

    expect(preview.ratio).toBe("4:5");
    expect(preview.canvas_resolution).toBe("1080x1350");
    expect(preview.grid_crop_square).toEqual({
      left: 0,
      top: 135,
      right: 1080,
      bottom: 1215,
      size: 1080,
    });
    expect(preview.visible_fraction_percent).toBe(80);
  });

  test("creates deterministic 3:4 and 9:16 crop windows", () => {
    const threeByFour = createGridPreview("3:4");
    const nineBySixteen = createGridPreview("9:16");

    expect(threeByFour.grid_crop_square.top).toBe(180);
    expect(threeByFour.visible_fraction_percent).toBe(75);
    expect(nineBySixteen.grid_crop_square.top).toBe(420);
    expect(nineBySixteen.visible_fraction_percent).toBe(56.25);
  });

  test("builds stable svg output", () => {
    const preview = createGridPreview("3:4");
    const svg = buildGridPreviewSvg(preview);

    expect(svg).toContain("viewBox=\"0 0 1080 1440\"");
    expect(svg).toContain("data-ratio=\"3:4\"");
    expect(svg).toContain("id=\"grid-crop-square\"");
  });
});
