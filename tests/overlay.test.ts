import { describe, expect, test } from "bun:test";
import { buildOverlaySvg, createOverlay } from "../src/domain/overlay";

describe("overlay domain", () => {
  test("creates deterministic 4:5 overlay geometry", () => {
    const overlay = createOverlay("4:5");

    expect(overlay.ratio).toBe("4:5");
    expect(overlay.canvas_resolution).toBe("1080x1350");
    expect(overlay.canvas.width).toBe(1080);
    expect(overlay.canvas.height).toBe(1350);
    expect(overlay.safe_zone).toEqual({
      left: 54,
      top: 68,
      right: 1026,
      bottom: 1282,
      width: 972,
      height: 1214,
    });
    expect(overlay.thirds.vertical).toEqual([360, 720]);
    expect(overlay.thirds.horizontal).toEqual([450, 900]);
  });

  test("creates deterministic 3:4 and 9:16 canvas sizes", () => {
    const threeByFour = createOverlay("3:4");
    const nineBySixteen = createOverlay("9:16");

    expect(threeByFour.canvas_resolution).toBe("1080x1440");
    expect(nineBySixteen.canvas_resolution).toBe("1080x1920");
  });

  test("builds stable svg output", () => {
    const overlay = createOverlay("9:16");
    const svg = buildOverlaySvg(overlay);

    expect(svg).toContain("viewBox=\"0 0 1080 1920\"");
    expect(svg).toContain("data-ratio=\"9:16\"");
    expect(svg).toContain("id=\"safe-zone\"");
    expect(svg).toContain("id=\"third-v-1\"");
    expect(svg).toContain("id=\"third-h-2\"");
  });
});
