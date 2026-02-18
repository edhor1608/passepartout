import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import type { WatchFolderInput, WatchFolderOutput } from "../types/contracts";
import { exportImage } from "./export_image";
import { exportVideo } from "./export_video";

type WatchState = {
  items: Record<string, { size: number; mtime_ms: number; output_path: string }>;
};

const IMAGE_EXT = new Set([".ppm", ".png", ".jpg", ".jpeg"]);
const VIDEO_EXT = new Set([".mp4", ".mov"]);

function statePath(outDir: string): string {
  return join(outDir, ".watch-state.json");
}

function readState(path: string): WatchState {
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { items: {} };
    }
    const parsedItems = (parsed as { items?: unknown }).items;
    if (typeof parsedItems !== "object" || parsedItems === null || Array.isArray(parsedItems)) {
      return { items: {} };
    }

    const items: WatchState["items"] = {};
    for (const [key, value] of Object.entries(parsedItems)) {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        typeof (value as { size?: unknown }).size === "number" &&
        Number.isFinite((value as { size: number }).size) &&
        typeof (value as { mtime_ms?: unknown }).mtime_ms === "number" &&
        Number.isFinite((value as { mtime_ms: number }).mtime_ms) &&
        typeof (value as { output_path?: unknown }).output_path === "string"
      ) {
        items[key] = {
          size: (value as { size: number }).size,
          mtime_ms: (value as { mtime_ms: number }).mtime_ms,
          output_path: (value as { output_path: string }).output_path,
        };
      }
    }
    return { items };
  } catch {
    return { items: {} };
  }
}

function writeState(path: string, state: WatchState): void {
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function listCandidates(inDir: string): string[] {
  const files = readdirSync(inDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(inDir, entry.name))
    .filter((file) => {
      const ext = extname(file).toLowerCase();
      return IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext);
    })
    .sort((a, b) => a.localeCompare(b));
  return files;
}

function signature(path: string): { size: number; mtime_ms: number } {
  const stat = statSync(path);
  return { size: stat.size, mtime_ms: Math.round(stat.mtimeMs) };
}

function outputPathFor(inputPath: string, outDir: string, kind: "image" | "video"): string {
  const base = basename(inputPath, extname(inputPath));
  if (kind === "image") {
    return join(outDir, `${base}.export.jpg`);
  }
  return join(outDir, `${base}.export.mp4`);
}

export function runWatchCycle(input: WatchFolderInput): WatchFolderOutput {
  const inputDir = resolve(input.inDir);
  const outputDir = resolve(input.outDir);
  mkdirSync(outputDir, { recursive: true });

  const watchStatePath = statePath(outputDir);
  const state = readState(watchStatePath);

  const processed: WatchFolderOutput["processed"] = [];
  const skipped: WatchFolderOutput["skipped"] = [];
  const errors: WatchFolderOutput["errors"] = [];

  for (const file of listCandidates(inputDir)) {
    const ext = extname(file).toLowerCase();
    const kind = VIDEO_EXT.has(ext) ? "video" : "image";
    const sig = signature(file);
    const existing = state.items[file];

    if (existing && existing.size === sig.size && existing.mtime_ms === sig.mtime_ms) {
      skipped.push({ input_path: file, reason: "unchanged" });
      continue;
    }

    const outPath = outputPathFor(file, outputDir, kind);

    try {
      if (kind === "image") {
        exportImage({
          file,
          out: outPath,
          mode: input.mode,
          surface: input.surface,
          workflow: input.workflow,
          whiteCanvas: input.whiteCanvas,
          canvasProfile: input.canvasProfile,
          canvasStyle: input.canvasStyle,
        });
      } else {
        exportVideo({
          file,
          out: outPath,
          mode: input.mode,
          surface: input.surface,
          workflow: input.workflow,
          whiteCanvas: input.whiteCanvas,
          canvasProfile: input.canvasProfile,
          canvasStyle: input.canvasStyle,
        });
      }

      state.items[file] = { ...sig, output_path: outPath };
      processed.push({ input_path: file, output_path: outPath, kind });
    } catch (error) {
      errors.push({
        input_path: file,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  writeState(watchStatePath, state);

  return {
    input_dir: inputDir,
    output_dir: outputDir,
    state_path: watchStatePath,
    once: input.once ?? false,
    processed_count: processed.length,
    skipped_count: skipped.length,
    error_count: errors.length,
    processed,
    skipped,
    errors,
  };
}
