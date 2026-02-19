import { describe, expect, test } from "bun:test";
import { recommend, toStableJson } from "../src/domain/recommend";

describe("recommend", () => {
  test("reliable feed portrait returns 1080x1350 and low risk", () => {
    const result = recommend({
      mode: "reliable",
      surface: "feed",
      orientation: "portrait",
      workflow: "unknown",
      whiteCanvas: false,
    });

    expect(result.target_resolution).toBe("1080x1350");
    expect(result.risk_level).toBe("low");
  });

  test("reliable feed square returns 1080x1080 and low risk", () => {
    const result = recommend({
      mode: "reliable",
      surface: "feed",
      orientation: "square",
      workflow: "unknown",
      whiteCanvas: false,
    });

    expect(result.target_resolution).toBe("1080x1080");
    expect(result.risk_level).toBe("low");
  });

  test("reliable feed landscape returns 1080x566 and low risk", () => {
    const result = recommend({
      mode: "reliable",
      surface: "feed",
      orientation: "landscape",
      workflow: "unknown",
      whiteCanvas: false,
    });

    expect(result.target_resolution).toBe("1080x566");
    expect(result.risk_level).toBe("low");
  });

  test("white-canvas defaults to feed_compat for unknown/api workflow", () => {
    const unknownResult = recommend({
      mode: "reliable",
      surface: "feed",
      orientation: "portrait",
      workflow: "unknown",
      whiteCanvas: true,
    });
    const apiResult = recommend({
      mode: "reliable",
      surface: "feed",
      orientation: "portrait",
      workflow: "api_scheduler",
      whiteCanvas: true,
    });

    expect(unknownResult.white_canvas.profile).toBe("feed_compat");
    expect(apiResult.white_canvas.profile).toBe("feed_compat");
    expect(unknownResult.target_resolution).toBe("1080x1350");
    expect(apiResult.target_resolution).toBe("1080x1350");
  });

  test("feed_app_direct falls back unless workflow is app_direct", () => {
    const blocked = recommend({
      mode: "reliable",
      surface: "feed",
      orientation: "landscape",
      workflow: "api_scheduler",
      whiteCanvas: true,
      canvasProfile: "feed_app_direct",
    });
    const allowed = recommend({
      mode: "reliable",
      surface: "feed",
      orientation: "landscape",
      workflow: "app_direct",
      whiteCanvas: true,
      canvasProfile: "feed_app_direct",
    });

    expect(blocked.white_canvas.profile).toBe("feed_compat");
    expect(blocked.workflow_note).toContain("fallback");
    expect(allowed.white_canvas.profile).toBe("feed_app_direct");
    expect(allowed.target_resolution).toBe("1080x1440");
  });

  test("white-canvas output always flags contain/no-crop invariants", () => {
    const result = recommend({
      mode: "reliable",
      surface: "feed",
      orientation: "portrait",
      workflow: "unknown",
      whiteCanvas: true,
    });

    expect(result.white_canvas.enabled).toBe(true);
    expect(result.white_canvas.contain_only).toBe(true);
    expect(result.white_canvas.no_crop).toBe(true);
    expect(result.white_canvas.style).toBe("gallery_clean");
  });

  test("white-canvas style defaults to gallery_clean and accepts polaroid_classic", () => {
    const defaultStyle = recommend({
      mode: "reliable",
      surface: "feed",
      orientation: "portrait",
      workflow: "unknown",
      whiteCanvas: true,
    });
    const classicStyle = recommend({
      mode: "reliable",
      surface: "feed",
      orientation: "portrait",
      workflow: "unknown",
      whiteCanvas: true,
      canvasStyle: "polaroid_classic",
    });

    expect(defaultStyle.white_canvas.style).toBe("gallery_clean");
    expect(classicStyle.white_canvas.style).toBe("polaroid_classic");
    expect(classicStyle.white_canvas.margins?.bottom).toBeGreaterThan(
      classicStyle.white_canvas.margins?.top ?? 0,
    );
  });

  test("deterministic output is stable for same input", () => {
    const input = {
      mode: "experimental" as const,
      surface: "feed" as const,
      orientation: "portrait" as const,
      workflow: "app_direct" as const,
      whiteCanvas: true,
      canvasProfile: "feed_app_direct" as const,
    };

    const a = toStableJson(recommend(input));
    const b = toStableJson(recommend(input));
    expect(a).toBe(b);
  });
});
