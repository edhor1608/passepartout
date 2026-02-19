import type { GridPreviewOutput, OverlayRatio, Resolution } from "../types/contracts";
import { canvasForRatio } from "./overlay";

export function createGridPreview(ratio: OverlayRatio): GridPreviewOutput {
  const { width, height } = canvasForRatio(ratio);
  const size = width;
  const top = Math.floor((height - size) / 2);
  const bottom = top + size;

  return {
    ratio,
    canvas_resolution: `${width}x${height}` as Resolution,
    canvas: { width, height },
    grid_crop_square: {
      left: 0,
      top,
      right: size,
      bottom,
      size,
    },
    visible_fraction_percent: Number.parseFloat(((size / height) * 100).toFixed(3)),
  };
}

export function buildGridPreviewSvg(preview: GridPreviewOutput): string {
  const { width, height } = preview.canvas;
  const crop = preview.grid_crop_square;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" data-ratio="${preview.ratio}">`,
    `  <rect id="post-frame" x="0" y="0" width="${width}" height="${height}" fill="none" stroke="#FFFFFF" stroke-width="4"/>`,
    `  <rect id="grid-crop-square" x="${crop.left}" y="${crop.top}" width="${crop.size}" height="${crop.size}" fill="none" stroke="#FF5252" stroke-width="4" stroke-dasharray="16 16"/>`,
    `  <line id="grid-crop-midline" x1="0" y1="${crop.top + Math.floor(crop.size / 2)}" x2="${width}" y2="${crop.top + Math.floor(crop.size / 2)}" stroke="#FFAB40" stroke-width="2" stroke-dasharray="8 10"/>`,
    "</svg>",
  ].join("\n");
}
