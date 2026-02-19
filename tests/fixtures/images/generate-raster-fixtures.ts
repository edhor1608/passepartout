import { join } from "node:path";

const dir = import.meta.dir;

const conversions = [
  {
    input: join(dir, "portrait_sample_30x40.ppm"),
    png: join(dir, "portrait_sample_30x40.png"),
    jpg: join(dir, "portrait_sample_30x40.jpg"),
  },
  {
    input: join(dir, "landscape_sample_48x32.ppm"),
    png: join(dir, "landscape_sample_48x32.png"),
    jpg: join(dir, "landscape_sample_48x32.jpg"),
  },
];

for (const item of conversions) {
  const png = Bun.spawnSync({
    cmd: ["sips", "-s", "format", "png", item.input, "--out", item.png],
    stdout: "ignore",
    stderr: "pipe",
  });
  if (png.exitCode !== 0) {
    throw new Error(`png conversion failed for ${item.input}: ${png.stderr.toString()}`);
  }

  const jpg = Bun.spawnSync({
    cmd: ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "90", item.input, "--out", item.jpg],
    stdout: "ignore",
    stderr: "pipe",
  });
  if (jpg.exitCode !== 0) {
    throw new Error(`jpg conversion failed for ${item.input}: ${jpg.stderr.toString()}`);
  }
}

console.log(`generated ${conversions.length * 2} raster fixtures`);
