import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, extname, join, parse, resolve } from "node:path";
import { renderReadyToUploadImage } from "./image_engine";

export const DEFAULT_PREPARE_IMAGE_BORDER_PX = 57;

type PrepareImagesInput = {
  inputPath: string;
  outputPath: string;
  borderPx?: number;
};

type PlannedImage = {
  sourcePath: string;
  requestedOutputPath: string;
};

type StagedImage = PlannedImage & {
  stagedOutputPath: string;
  stagingDirectory: string;
};

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".tif", ".tiff"]);

export function prepareImages(input: PrepareImagesInput): string[] {
  const plans = planImages(resolve(input.inputPath), resolve(input.outputPath));
  const stagedImages: StagedImage[] = [];
  const committedPaths: string[] = [];

  try {
    for (const plan of plans) {
      const requestedOutputPath = normalizeJpegExtension(plan.requestedOutputPath);
      const outputDirectory = dirname(requestedOutputPath);
      mkdirSync(outputDirectory, { recursive: true });
      const stagingDirectory = mkdtempSync(join(outputDirectory, ".passepartout-"));
      const stagedOutputPath = join(stagingDirectory, "prepared.jpg");
      const stagedImage = { ...plan, stagedOutputPath, stagingDirectory };
      stagedImages.push(stagedImage);

      renderReadyToUploadImage({
        borderPx: input.borderPx ?? DEFAULT_PREPARE_IMAGE_BORDER_PX,
        outputPath: stagedOutputPath,
        sourcePath: plan.sourcePath,
      });
    }

    for (const stagedImage of stagedImages) {
      const committedPath = commitWithoutOverwrite(
        stagedImage.stagedOutputPath,
        normalizeJpegExtension(stagedImage.requestedOutputPath),
      );
      committedPaths.push(committedPath);
      unlinkSync(stagedImage.stagedOutputPath);
    }

    return committedPaths;
  } catch (error) {
    for (const committedPath of committedPaths) {
      unlinkIfExists(committedPath);
    }
    throw error;
  } finally {
    for (const stagedImage of stagedImages) {
      rmSync(stagedImage.stagingDirectory, { force: true, recursive: true });
    }
  }
}

function planImages(inputPath: string, outputPath: string): PlannedImage[] {
  const inputStat = statSync(inputPath);
  if (!inputStat.isDirectory()) {
    assertSupportedSource(inputPath);
    if (statSyncIfExists(outputPath)?.isDirectory()) {
      throw new Error("--out must be a file path, not a directory");
    }
    if (outputPath.trim() === "") {
      throw new Error("--out must be a file path");
    }
    return [{ requestedOutputPath: outputPath, sourcePath: inputPath }];
  }

  if (statSyncIfExists(outputPath)?.isFile()) {
    throw new Error("--out must be a directory for directory input");
  }

  const sourcePaths = readdirSync(inputPath)
    .filter((entry) => isSupportedSource(entry))
    .sort()
    .map((entry) => join(inputPath, entry))
    .filter((entryPath) => statSync(entryPath).isFile());

  if (sourcePaths.length === 0) {
    throw new Error("No supported images found in directory");
  }

  return sourcePaths.map((sourcePath) => ({
    requestedOutputPath: join(outputPath, parse(sourcePath).name),
    sourcePath,
  }));
}

function assertSupportedSource(path: string): void {
  if (!isSupportedSource(path)) {
    const extension = extname(path).toLowerCase();
    throw new Error(
      `Unsupported input format${extension === "" ? "" : `: ${extension}`}; expected PNG, JPEG, or TIFF`,
    );
  }
}

function isSupportedSource(path: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(path).toLowerCase());
}

function normalizeJpegExtension(requestedPath: string): string {
  const extension = extname(requestedPath);
  if (extension === "") {
    return `${requestedPath}.jpg`;
  }

  return `${requestedPath.slice(0, -extension.length)}.jpg`;
}

function commitWithoutOverwrite(stagedPath: string, requestedPath: string): string {
  const parsed = parse(requestedPath);

  for (let index = 0; ; index += 1) {
    const candidate = index === 0 ? requestedPath : join(parsed.dir, `${parsed.name}-${index}.jpg`);
    try {
      linkSync(stagedPath, candidate);
      return candidate;
    } catch (error) {
      if (hasErrorCode(error, "EEXIST")) {
        continue;
      }
      throw error;
    }
  }
}

function statSyncIfExists(path: string): ReturnType<typeof statSync> | null {
  try {
    return statSync(path);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return null;
    }
    throw error;
  }
}

function unlinkIfExists(path: string): void {
  try {
    unlinkSync(path);
  } catch (error) {
    if (!hasErrorCode(error, "ENOENT")) {
      throw error;
    }
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
