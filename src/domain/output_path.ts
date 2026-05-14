import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, extname, join, parse } from "node:path";

export function resolvePrepareImageOutputPath(requestedPath: string): string {
  if (requestedPath.trim() === "") {
    throw new Error("--out must be a file path");
  }

  if (existsSync(requestedPath) && statSync(requestedPath).isDirectory()) {
    throw new Error("--out must be a file path, not a directory");
  }

  const normalizedPath = normalizeJpegExtension(requestedPath);
  mkdirSync(dirname(normalizedPath), { recursive: true });

  if (!existsSync(normalizedPath)) {
    return normalizedPath;
  }

  const parsed = parse(normalizedPath);
  for (let index = 1; ; index += 1) {
    const candidate = join(parsed.dir, `${parsed.name}-${index}.jpg`);
    if (!existsSync(candidate)) {
      return candidate;
    }
  }
}

function normalizeJpegExtension(requestedPath: string): string {
  const extension = extname(requestedPath);
  if (extension === "") {
    return `${requestedPath}.jpg`;
  }

  return `${requestedPath.slice(0, -extension.length)}.jpg`;
}
