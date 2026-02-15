import { readFileSync } from "node:fs";

export type PpmMeta = {
  width: number;
  height: number;
};

export function readPpmMeta(path: string): PpmMeta {
  const content = readFileSync(path, "utf8");
  const tokens = content
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !token.startsWith("#"));

  if (tokens[0] !== "P3") {
    throw new Error(`Unsupported PPM format in ${path}`);
  }

  const width = Number.parseInt(tokens[1] ?? "", 10);
  const height = Number.parseInt(tokens[2] ?? "", 10);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Invalid PPM size in ${path}`);
  }

  return { width, height };
}

export function orientationFromSize(width: number, height: number): "portrait" | "square" | "landscape" {
  if (width === height) {
    return "square";
  }
  return width > height ? "landscape" : "portrait";
}
