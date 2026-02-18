import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { recommend } from "../../../src/domain/recommend";
import { parseResolution } from "../../../src/domain/rules";
import { orientationFromSize, readPpmMeta } from "../../helpers/ppm";
import { renderLayoutAscii } from "../../helpers/visual";

const visualDir = import.meta.dir;
const imageDir = join(visualDir, "..", "images");
const outDir = join(visualDir, "snapshots");
mkdirSync(outDir, { recursive: true });

const imageFiles = readdirSync(imageDir)
  .filter((name) => name.endsWith(".ppm"))
  .sort();

for (const file of imageFiles) {
  const fullPath = join(imageDir, file);
  const meta = readPpmMeta(fullPath);
  const orientation = orientationFromSize(meta.width, meta.height);

  const scenarios = [
    { suffix: "compat", workflow: "unknown" as const, canvasProfile: "feed_compat" as const },
    { suffix: "app_direct", workflow: "app_direct" as const, canvasProfile: "feed_app_direct" as const },
  ];

  for (const scenario of scenarios) {
    const rec = recommend({
      mode: "reliable",
      surface: "feed",
      orientation,
      workflow: scenario.workflow,
      whiteCanvas: true,
      canvasProfile: scenario.canvasProfile,
      sourceRatio: meta.width / meta.height,
    });

    if (!rec.white_canvas.margins) {
      throw new Error(`expected margins for ${file}`);
    }

    const { width, height } = parseResolution(rec.target_resolution);
    const ascii = renderLayoutAscii({
      canvasWidth: width,
      canvasHeight: height,
      margins: rec.white_canvas.margins,
    });

    writeFileSync(join(outDir, `${basename(file, ".ppm")}.${scenario.suffix}.txt`), `${ascii}\n`, "utf8");
  }
}

console.log("generated visual snapshots");
