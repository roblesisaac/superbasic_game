import { GATE_THICKNESS } from '../../config/constants.js';
import {
  drawPixelatedHeart,
  HEART_PIXEL_COLUMNS,
  HEART_PIXEL_ROWS,
} from '../gui/drawPixelatedHeart.js';

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
  asciiDamaged: boolean;
  gapInfo?: GateVisualGapInfo | null;
  gapReward?: GateGapRewardInfo | null;
}

export interface GateGapRewardInfo {
  type: 'heart';
  color?: string;
  pixelSize?: number;
}

export function drawGateVisuals({
  ctx,
  rects,
  cameraY,
  asciiDamaged,
  gapInfo,
  gapReward,
}: DrawGateVisualsOptions) {
  const visualThickness = Math.max(1, Math.round(GATE_THICKNESS / 5));
  const defaultColor = '#fff';
  const damagedColor = '#ffd400';
  const gateColor = asciiDamaged ? damagedColor : defaultColor;

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

  if (!gapReward || gapReward.type !== 'heart') return;

  const pixelSize = Math.max(1, Math.floor(gapReward.pixelSize ?? GATE_THICKNESS / HEART_PIXEL_ROWS));
  const heartWidth = HEART_PIXEL_COLUMNS * pixelSize;
  const heartHeight = HEART_PIXEL_ROWS * pixelSize;

  let centerX: number;
  let centerY: number;

  if (gapInfo.type === 'H') {
    centerX = gapInfo.gapX + gapInfo.gapWidth / 2;
    centerY = gapInfo.gapY - cameraY + GATE_THICKNESS / 2;
  } else {
    centerX = gapInfo.gapX + GATE_THICKNESS / 2;
    centerY = gapInfo.gapY - cameraY + gapInfo.gapWidth / 2;
  }

  const drawX = centerX - heartWidth / 2;
  const drawY = centerY - heartHeight / 2;
  const color = gapReward.color ?? '#ff5b6e';

  drawPixelatedHeart(ctx, drawX, drawY, pixelSize, color);
}
