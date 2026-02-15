import { describe, expect, test } from "bun:test";
import { computeMarginsV1 } from "../../src/domain/white_canvas";

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("margins invariants", () => {
  test("portrait branch keeps all margins equal", () => {
    const rand = lcg(42);
    for (let i = 0; i < 500; i += 1) {
      const w = 600 + Math.floor(rand() * 3000);
      const h = 600 + Math.floor(rand() * 3000);
      const ratio = rand();

      const m = computeMarginsV1({ canvasWidth: w, canvasHeight: h, sourceRatio: ratio });
      expect(m.left).toBe(m.right);
      expect(m.left).toBe(m.top);
      expect(m.left).toBe(m.bottom);
    }
  });

  test("landscape branch follows formula exactly and keeps positive inner box", () => {
    const rand = lcg(1337);
    for (let i = 0; i < 500; i += 1) {
      const w = 600 + Math.floor(rand() * 3000);
      const h = 600 + Math.floor(rand() * 3000);
      const ratio = 1.0001 + rand() * 5;

      const m = computeMarginsV1({ canvasWidth: w, canvasHeight: h, sourceRatio: ratio });
      expect(m.left).toBe(m.right);
      expect(m.top).toBe(m.bottom);
      expect(m.left).toBe(Math.round(0.04 * w));
      expect(m.top).toBe(Math.round(0.16 * h));

      const innerW = w - (m.left + m.right);
      const innerH = h - (m.top + m.bottom);
      expect(innerW).toBeGreaterThan(0);
      expect(innerH).toBeGreaterThan(0);
    }
  });
});
