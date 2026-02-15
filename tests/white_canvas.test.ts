import { describe, expect, test } from "bun:test";
import { computeMarginsV1 } from "../src/domain/white_canvas";

describe("white canvas margins v1", () => {
  test("1080x1350 with r<=1.0 gives 54 margins", () => {
    const margins = computeMarginsV1({ canvasWidth: 1080, canvasHeight: 1350, sourceRatio: 1.0 });
    expect(margins).toEqual({ left: 54, top: 54, right: 54, bottom: 54 });
  });

  test("1080x1350 with r>1.0 gives 43/216/43/216", () => {
    const margins = computeMarginsV1({ canvasWidth: 1080, canvasHeight: 1350, sourceRatio: 1.2 });
    expect(margins).toEqual({ left: 43, top: 216, right: 43, bottom: 216 });
  });

  test("1080x1440 with r<=1.0 gives 54 margins", () => {
    const margins = computeMarginsV1({ canvasWidth: 1080, canvasHeight: 1440, sourceRatio: 1.0 });
    expect(margins).toEqual({ left: 54, top: 54, right: 54, bottom: 54 });
  });

  test("1080x1440 with r>1.0 gives 43/230/43/230", () => {
    const margins = computeMarginsV1({ canvasWidth: 1080, canvasHeight: 1440, sourceRatio: 1.5 });
    expect(margins).toEqual({ left: 43, top: 230, right: 43, bottom: 230 });
  });
});
