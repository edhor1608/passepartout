import type { Margins } from "../../src/types/contracts";

export function renderLayoutAscii(params: {
  canvasWidth: number;
  canvasHeight: number;
  margins: Margins;
  gridWidth?: number;
  gridHeight?: number;
}): string {
  const { canvasWidth, canvasHeight, margins, gridWidth = 40, gridHeight = 24 } = params;
  const left = margins.left;
  const top = margins.top;
  const rightEdge = canvasWidth - margins.right;
  const bottomEdge = canvasHeight - margins.bottom;

  const rows: string[] = [];
  for (let y = 0; y < gridHeight; y += 1) {
    let row = "";
    const cy = ((y + 0.5) / gridHeight) * canvasHeight;

    for (let x = 0; x < gridWidth; x += 1) {
      const cx = ((x + 0.5) / gridWidth) * canvasWidth;
      const inside = cx >= left && cx < rightEdge && cy >= top && cy < bottomEdge;
      row += inside ? "#" : ".";
    }

    rows.push(row);
  }

  return rows.join("\n");
}
