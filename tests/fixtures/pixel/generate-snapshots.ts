import { mkdirSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { recommend } from "../../../src/domain/recommend";
import { parseResolution } from "../../../src/domain/rules";
import { readP3Image, renderContainCanvas, writeP6Image } from "../../helpers/image";
import { orientationFromSize } from "../../helpers/ppm";

const pixelDir = import.meta.dir;
const imageDir = join(pixelDir, "..", "images");
const outDir = join(pixelDir, "snapshots");
mkdirSync(outDir, { recursive: true });

const scenarios = [
  { suffix: "compat", workflow: "unknown" as const, canvasProfile: "feed_compat" as const },
  { suffix: "app_direct", workflow: "app_direct" as const, canvasProfile: "feed_app_direct" as const },
  {
    suffix: "fallback",
    workflow: "api_scheduler" as const,
    canvasProfile: "feed_app_direct" as const,
  },
];

for (const file of readdirSync(imageDir).filter((name) => name.endsWith(".ppm"))) {
  const fullPath = join(imageDir, file);
  const source = readP3Image(fullPath);
  const orientation = orientationFromSize(source.width, source.height);

  for (const scenario of scenarios) {
    const rec = recommend({
      mode: "reliable",
      surface: "feed",
      orientation,
      workflow: scenario.workflow,
      whiteCanvas: true,
      canvasProfile: scenario.canvasProfile,
      sourceRatio: source.width / source.height,
    });

    if (!rec.white_canvas.margins) {
      throw new Error(`expected margins for ${file}`);
    }

    const { width, height } = parseResolution(rec.target_resolution);
    const rendered = renderContainCanvas({
      source,
      canvasWidth: width,
      canvasHeight: height,
      margins: rec.white_canvas.margins,
    });

    writeP6Image(join(outDir, `${basename(file, ".ppm")}.${scenario.suffix}.ppm`), rendered);
  }
}

console.log("generated pixel snapshots");
