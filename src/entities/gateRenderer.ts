import { GATE_THICKNESS } from '../config/constants.js';

export interface GateVisualRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GateVisualGapInfo {
  type: 'H' | 'V';
  gapX: number;
  gapY: number;
  gapWidth: number;
}

export interface DrawGateVisualsOptions {
  ctx: CanvasRenderingContext2D;
  rects: GateVisualRect[];
  cameraY: number;
  gapInfo?: GateVisualGapInfo | null;
}

export function drawGateVisuals({
  ctx,
  rects,
  cameraY,
  gapInfo,
}: DrawGateVisualsOptions) {
  const visualThickness = Math.max(1, Math.round(GATE_THICKNESS / 5));
  ctx.fillStyle = '#fff';

  for (const rect of rects) {
    if (rect.w <= 0 || rect.h <= 0) continue;

    const isHorizontal = rect.w >= rect.h;
    if (isHorizontal) {
      const height = Math.min(visualThickness, rect.h);
      const offsetY = (rect.h - height) / 2;
      ctx.fillRect(rect.x, rect.y - cameraY + offsetY, rect.w, height);
    } else {
      const width = Math.min(visualThickness, rect.w);
      const offsetX = (rect.w - width) / 2;
      ctx.fillRect(rect.x + offsetX, rect.y - cameraY, width, rect.h);
    }
  }

  if (!gapInfo) return;

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  if (gapInfo.type === 'H') {
    ctx.fillRect(gapInfo.gapX, gapInfo.gapY - cameraY, 1, GATE_THICKNESS);
    ctx.fillRect(gapInfo.gapX + gapInfo.gapWidth, gapInfo.gapY - cameraY, 1, GATE_THICKNESS);
  } else {
    ctx.fillRect(gapInfo.gapX, gapInfo.gapY - cameraY, GATE_THICKNESS, 1);
    ctx.fillRect(
      gapInfo.gapX,
      gapInfo.gapY + gapInfo.gapWidth - cameraY,
      GATE_THICKNESS,
      1,
    );
  }
}
