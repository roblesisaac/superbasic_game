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
  asciiEnabled: boolean;
  asciiDamaged: boolean;
  gapInfo?: GateVisualGapInfo | null;
}

export function drawGateVisuals({
  ctx,
  rects,
  cameraY,
  asciiEnabled,
  asciiDamaged,
  gapInfo,
}: DrawGateVisualsOptions) {
  if (asciiEnabled) {
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const horizontalGlyph = asciiDamaged ? '.' : ':';
    const verticalGlyph = asciiDamaged ? ':' : '::';

    for (const rect of rects) {
      if (rect.w <= 0 || rect.h <= 0) continue;

      if (rect.w > rect.h) {
        const count = Math.max(1, Math.floor(rect.w / 10));
        const ascii = horizontalGlyph.repeat(count);
        ctx.fillText(ascii, rect.x + rect.w / 2, rect.y - cameraY + rect.h / 2);
      } else {
        const count = Math.max(1, Math.floor(rect.h / 16));
        for (let i = 0; i < count; i++) {
          ctx.fillText(
            verticalGlyph,
            rect.x + rect.w / 2,
            rect.y - cameraY + (i + 0.5) * (rect.h / count),
          );
        }
      }
    }
    return;
  }

  const visualThickness = Math.max(1, Math.round(GATE_THICKNESS / 5));
  const defaultColor = '#fff';
  const damagedColor = '#ffd400';
  const gateColor = !asciiEnabled && asciiDamaged ? damagedColor : defaultColor;

  const drawSegments = () => {
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
  };

  const glowBlur = Math.max(visualThickness * 3, asciiDamaged ? 18 : 12);
  const glowColor = asciiDamaged ? 'rgba(255,212,0,1)' : 'rgba(255,255,255,1)';

  ctx.save();
  ctx.fillStyle = gateColor;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = glowBlur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  drawSegments();
  ctx.restore();

  ctx.fillStyle = gateColor;
  drawSegments();

  if (!gapInfo) return;

  const gapHighlightColor = asciiDamaged
    ? 'rgba(255,212,0,0.3)'
    : 'rgba(255,255,255,0.18)';
  ctx.fillStyle = gapHighlightColor;
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