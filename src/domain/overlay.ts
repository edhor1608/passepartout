import type { OverlayOutput, OverlayRatio, Resolution } from "../types/contracts";

function ratioCanvas(ratio: OverlayRatio): { width: number; height: number } {
  switch (ratio) {
    case "4:5":
      return { width: 1080, height: 1350 };
    case "3:4":
      return { width: 1080, height: 1440 };
    case "9:16":
      return { width: 1080, height: 1920 };
    default:
      throw new Error(`Unsupported ratio: ${ratio}`);
  }
}

export function createOverlay(ratio: OverlayRatio): OverlayOutput {
  const { width, height } = ratioCanvas(ratio);
  const insetX = Math.round(width * 0.05);
  const insetY = Math.round(height * 0.05);

  const safeLeft = insetX;
  const safeTop = insetY;
  const safeRight = width - insetX;
  const safeBottom = height - insetY;

  const v1 = Math.round(width / 3);
  const v2 = Math.round((2 * width) / 3);
  const h1 = Math.round(height / 3);
  const h2 = Math.round((2 * height) / 3);

  return {
    ratio,
    canvas_resolution: `${width}x${height}` as Resolution,
    canvas: { width, height },
    safe_zone: {
      left: safeLeft,
      top: safeTop,
      right: safeRight,
      bottom: safeBottom,
      width: safeRight - safeLeft,
      height: safeBottom - safeTop,
    },
    thirds: {
      vertical: [v1, v2],
      horizontal: [h1, h2],
    },
  };
}

export function buildOverlaySvg(overlay: OverlayOutput): string {
  const { width, height } = overlay.canvas;
  const safe = overlay.safe_zone;
  const [v1, v2] = overlay.thirds.vertical;
  const [h1, h2] = overlay.thirds.horizontal;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" data-ratio="${overlay.ratio}">`,
    `  <rect id="border" x="0" y="0" width="${width}" height="${height}" fill="none" stroke="#FFFFFF" stroke-width="4"/>`,
    `  <rect id="safe-zone" x="${safe.left}" y="${safe.top}" width="${safe.width}" height="${safe.height}" fill="none" stroke="#00E676" stroke-width="4" stroke-dasharray="16 16"/>`,
    `  <line id="third-v-1" x1="${v1}" y1="0" x2="${v1}" y2="${height}" stroke="#00B0FF" stroke-width="2" stroke-dasharray="8 12"/>`,
    `  <line id="third-v-2" x1="${v2}" y1="0" x2="${v2}" y2="${height}" stroke="#00B0FF" stroke-width="2" stroke-dasharray="8 12"/>`,
    `  <line id="third-h-1" x1="0" y1="${h1}" x2="${width}" y2="${h1}" stroke="#00B0FF" stroke-width="2" stroke-dasharray="8 12"/>`,
    `  <line id="third-h-2" x1="0" y1="${h2}" x2="${width}" y2="${h2}" stroke="#00B0FF" stroke-width="2" stroke-dasharray="8 12"/>`,
    "</svg>",
  ].join("\n");
}
