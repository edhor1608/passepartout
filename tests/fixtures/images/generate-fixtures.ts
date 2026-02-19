import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = import.meta.dir;
mkdirSync(outDir, { recursive: true });

function makeP3(width: number, height: number, seed: number): string {
  const lines: string[] = ["P3", `${width} ${height}`, "255"];

  for (let y = 0; y < height; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < width; x += 1) {
      const r = (x * 17 + seed) % 256;
      const g = (y * 29 + seed * 2) % 256;
      const b = ((x + y) * 13 + seed * 3) % 256;
      row.push(`${r} ${g} ${b}`);
    }
    lines.push(row.join(" "));
  }

  return `${lines.join("\n")}\n`;
}

const fixtures = [
  { name: "portrait_sample_30x40.ppm", w: 30, h: 40, seed: 7 },
  { name: "square_sample_36x36.ppm", w: 36, h: 36, seed: 11 },
  { name: "landscape_sample_48x32.ppm", w: 48, h: 32, seed: 19 },
  { name: "ultrawide_sample_60x24.ppm", w: 60, h: 24, seed: 23 },
  { name: "micro_portrait_9x16.ppm", w: 9, h: 16, seed: 31 },
  { name: "micro_landscape_16x9.ppm", w: 16, h: 9, seed: 37 }
];

for (const fixture of fixtures) {
  const ppm = makeP3(fixture.w, fixture.h, fixture.seed);
  writeFileSync(join(outDir, fixture.name), ppm, "utf8");
}

console.log(`generated ${fixtures.length} image fixtures in ${outDir}`);
