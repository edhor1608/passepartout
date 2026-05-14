export type PrepareImageVariant = "landscape" | "portrait";

export type SourceCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PrepareImageLayout = {
  variant: PrepareImageVariant;
  outputWidth: number;
  outputHeight: number;
  effectiveBorderPx: number;
  innerWidth: number;
  innerHeight: number;
  renderWidth: number;
  renderHeight: number;
  renderOffsetX: number;
  renderOffsetY: number;
  sourceCrop?: SourceCrop;
};

type PrepareImageLayoutInput = {
  sourceWidth: number;
  sourceHeight: number;
  borderPx: number;
};

type Target = {
  variant: PrepareImageVariant;
  maxWidth: number;
  maxHeight: number;
  ratioWidth: number;
  ratioHeight: number;
};

const LANDSCAPE_TARGET = {
  maxHeight: 1440,
  maxWidth: 2160,
  ratioHeight: 2,
  ratioWidth: 3,
  variant: "landscape",
} as const satisfies Target;

const PORTRAIT_TARGET = {
  maxHeight: 1920,
  maxWidth: 1440,
  ratioHeight: 4,
  ratioWidth: 3,
  variant: "portrait",
} as const satisfies Target;

export function computePrepareImageLayout(input: PrepareImageLayoutInput): PrepareImageLayout {
  assertPositiveInteger(input.sourceWidth, "sourceWidth");
  assertPositiveInteger(input.sourceHeight, "sourceHeight");
  assertNonNegativeInteger(input.borderPx, "borderPx");

  const target = input.sourceWidth > input.sourceHeight ? LANDSCAPE_TARGET : PORTRAIT_TARGET;

  for (let outputWidth = target.maxWidth; outputWidth >= target.ratioWidth; outputWidth -= target.ratioWidth) {
    const outputHeight = (outputWidth / target.ratioWidth) * target.ratioHeight;
    if (outputHeight > target.maxHeight) {
      continue;
    }

    const effectiveBorderPx = scaleBorder(input.borderPx, outputWidth / target.maxWidth);
    const innerWidth = outputWidth - 2 * effectiveBorderPx;
    const innerHeight = outputHeight - 2 * effectiveBorderPx;
    if (innerWidth <= 0 || innerHeight <= 0) {
      continue;
    }

    if (target.variant === "landscape") {
      if (innerWidth > input.sourceWidth || innerHeight > input.sourceHeight) {
        continue;
      }

      return createLandscapeLayout(input, {
        effectiveBorderPx,
        innerHeight,
        innerWidth,
        outputHeight,
        outputWidth,
      });
    }

    if (Math.min(innerWidth / input.sourceWidth, innerHeight / input.sourceHeight) > 1) {
      continue;
    }

    return createPortraitLayout(input, {
      effectiveBorderPx,
      innerHeight,
      innerWidth,
      outputHeight,
      outputWidth,
    });
  }

  throw new Error("Source image is too small for the requested border");
}

function createLandscapeLayout(
  input: PrepareImageLayoutInput,
  dimensions: Pick<
    PrepareImageLayout,
    "effectiveBorderPx" | "innerHeight" | "innerWidth" | "outputHeight" | "outputWidth"
  >,
): PrepareImageLayout {
  const crop = computeCenteredCoverCrop({
    frameHeight: dimensions.innerHeight,
    frameWidth: dimensions.innerWidth,
    sourceHeight: input.sourceHeight,
    sourceWidth: input.sourceWidth,
  });

  return {
    ...dimensions,
    renderHeight: dimensions.innerHeight,
    renderOffsetX: dimensions.effectiveBorderPx,
    renderOffsetY: dimensions.effectiveBorderPx,
    renderWidth: dimensions.innerWidth,
    sourceCrop: crop,
    variant: "landscape",
  };
}

function createPortraitLayout(
  input: PrepareImageLayoutInput,
  dimensions: Pick<
    PrepareImageLayout,
    "effectiveBorderPx" | "innerHeight" | "innerWidth" | "outputHeight" | "outputWidth"
  >,
): PrepareImageLayout {
  const renderScale = Math.min(
    1,
    dimensions.innerWidth / input.sourceWidth,
    dimensions.innerHeight / input.sourceHeight,
  );
  const renderWidth = Math.min(dimensions.innerWidth, Math.round(input.sourceWidth * renderScale));
  const renderHeight = Math.min(dimensions.innerHeight, Math.round(input.sourceHeight * renderScale));

  return {
    ...dimensions,
    renderHeight,
    renderOffsetX: Math.round((dimensions.outputWidth - renderWidth) / 2),
    renderOffsetY: Math.round((dimensions.outputHeight - renderHeight) / 2),
    renderWidth,
    variant: "portrait",
  };
}

function computeCenteredCoverCrop(input: {
  sourceWidth: number;
  sourceHeight: number;
  frameWidth: number;
  frameHeight: number;
}): SourceCrop {
  const sourceRatio = input.sourceWidth / input.sourceHeight;
  const frameRatio = input.frameWidth / input.frameHeight;

  if (sourceRatio > frameRatio) {
    const width = Math.round(input.sourceHeight * frameRatio);
    return {
      height: input.sourceHeight,
      width,
      x: Math.round((input.sourceWidth - width) / 2),
      y: 0,
    };
  }

  const height = Math.round(input.sourceWidth / frameRatio);
  return {
    height,
    width: input.sourceWidth,
    x: 0,
    y: Math.round((input.sourceHeight - height) / 2),
  };
}

function scaleBorder(borderPx: number, scale: number): number {
  if (borderPx === 0) {
    return 0;
  }

  return Math.max(1, Math.round(borderPx * scale));
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}
