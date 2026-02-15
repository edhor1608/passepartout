import { describe, expect, test } from "bun:test";
import { parseJsonStdout, runRecommendCli } from "../helpers/cli";

describe("cli integration", () => {
  test("json output includes required contract fields", async () => {
    const result = await runRecommendCli([
      "--mode",
      "reliable",
      "--surface",
      "feed",
      "--orientation",
      "portrait",
      "--workflow",
      "unknown",
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    const payload = parseJsonStdout(result.stdout);
    expect(payload).toHaveProperty("selected_mode", "reliable");
    expect(payload).toHaveProperty("selected_profile");
    expect(payload).toHaveProperty("target_resolution");
    expect(payload).toHaveProperty("reason");
    expect(payload).toHaveProperty("risk_level");
    expect(payload).toHaveProperty("workflow_note");
    expect(payload).toHaveProperty("white_canvas");
  });

  test("non-json output includes human summary blocks", async () => {
    const result = await runRecommendCli([
      "--mode",
      "reliable",
      "--surface",
      "feed",
      "--orientation",
      "landscape",
      "--workflow",
      "api_scheduler",
      "--white-canvas",
      "--canvas-profile",
      "feed_app_direct",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Summary:");
    expect(result.stdout).toContain("Profile:");
    expect(result.stdout).toContain("Reason:");
    expect(result.stdout).toContain("Warnings:");
    expect(result.stdout).toContain("Workflow note:");
  });

  test("invalid mode fails with non-zero exit", async () => {
    const result = await runRecommendCli([
      "--mode",
      "invalid",
      "--surface",
      "feed",
      "--orientation",
      "portrait",
      "--json",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Invalid mode");
  });

  test("invalid canvas style fails with non-zero exit", async () => {
    const result = await runRecommendCli([
      "--mode",
      "reliable",
      "--surface",
      "feed",
      "--orientation",
      "portrait",
      "--white-canvas",
      "--canvas-style",
      "bad_style",
      "--json",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Invalid canvas style");
  });

  test("white-canvas on story is enabled with surface default profile", async () => {
    const result = await runRecommendCli([
      "--mode",
      "reliable",
      "--surface",
      "story",
      "--orientation",
      "portrait",
      "--workflow",
      "unknown",
      "--white-canvas",
      "--json",
    ]);

    const payload = parseJsonStdout(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(payload.workflow_note).toBe("Using story_default white-canvas profile.");
    expect(payload.white_canvas).toEqual({
      contain_only: true,
      enabled: true,
      margins: { bottom: 54, left: 54, right: 54, top: 54 },
      no_crop: true,
      profile: "story_default",
      style: "gallery_clean",
    });
  });
});
