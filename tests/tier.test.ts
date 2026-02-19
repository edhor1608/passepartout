import { describe, expect, test } from "bun:test";
import { classifyTier } from "../src/domain/tier";

describe("tier classifier", () => {
  test("tier_upscale when width < 320", () => {
    const tier = classifyTier({ width: 319, height: 398, surface: "feed" });
    expect(tier.name).toBe("tier_upscale");
    expect(tier.risk_level).toBe("high");
  });

  test("tier_preserve when 320..1080 and supported aspect", () => {
    const tier = classifyTier({ width: 1080, height: 1350, surface: "feed" });
    expect(tier.name).toBe("tier_preserve");
    expect(tier.risk_level).toBe("low");
  });

  test("tier_downscale when width > 1080", () => {
    const tier = classifyTier({ width: 1200, height: 1500, surface: "feed" });
    expect(tier.name).toBe("tier_downscale");
    expect(tier.risk_level).toBe("medium");
  });

  test("tier_aspect_correction for unsupported feed ratio", () => {
    const tier = classifyTier({ width: 4000, height: 1000, surface: "feed" });
    expect(tier.name).toBe("tier_aspect_correction");
    expect(tier.risk_level).toBe("medium");
  });

  test("story supports 9:16 ratio", () => {
    const tier = classifyTier({ width: 1080, height: 1920, surface: "story" });
    expect(tier.name).not.toBe("tier_aspect_correction");
  });
});
