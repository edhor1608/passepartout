export const pixelScenarios = [
  { suffix: "compat", workflow: "unknown" as const, canvasProfile: "feed_compat" as const },
  { suffix: "app_direct", workflow: "app_direct" as const, canvasProfile: "feed_app_direct" as const },
  {
    suffix: "fallback",
    workflow: "api_scheduler" as const,
    canvasProfile: "feed_app_direct" as const,
  },
] as const;
