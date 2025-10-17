import { SPRITE_SIZE } from '../../config/constants.js';

interface DrawWellOptions {
  centerX: number;
  groundY: number;
  cameraY: number;
  canvasHeight: number;
  openingWidth?: number;
}

const DEFAULT_OPENING_WIDTH = SPRITE_SIZE * 2;
const RIM_PADDING = 3;
const RIM_HEIGHT = 5;
const INTERIOR_OFFSET = 2;
const BRICK_HEIGHT = 4;
const BRICK_GAP = 3;

function normalizeOpeningWidth(width: number | undefined): number {
  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) {
    return DEFAULT_OPENING_WIDTH;
  }

  return Math.max(8, Math.round(width));
}

export function drawWell(ctx: CanvasRenderingContext2D, options: DrawWellOptions): void {
  const { centerX, groundY, cameraY, canvasHeight } = options;
  const openingWidth = normalizeOpeningWidth(options.openingWidth);

  if (!Number.isFinite(centerX) || !Number.isFinite(groundY)) return;

  const screenGroundY = Math.round(groundY - cameraY);
  const canvasH = Math.max(0, Math.floor(canvasHeight));

  if (screenGroundY < -64 || screenGroundY > canvasH + 64) {
    return;
  }

  const halfOpening = Math.floor(openingWidth / 2);
  const roundedCenterX = Math.round(centerX);
  const rimLeft = roundedCenterX - halfOpening - RIM_PADDING;
  const rimRight = rimLeft + openingWidth + RIM_PADDING * 2;
  const rimTop = screenGroundY - RIM_HEIGHT;
  const rimBottom = screenGroundY + 1;
  const rimWidth = rimRight - rimLeft;
  const interiorLeft = roundedCenterX - halfOpening;
  const interiorRight = interiorLeft + openingWidth;
  const interiorWidth = interiorRight - interiorLeft;
  const interiorTop = rimTop + INTERIOR_OFFSET;

  // Rim top highlight
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(rimLeft, rimTop, rimWidth, 1);

  // Rim body
  ctx.fillStyle = '#d9d9d9';
  for (let y = 1; y < RIM_HEIGHT; y += 1) {
    const offsetY = rimTop + y;
    if (offsetY > rimBottom) break;
    ctx.fillRect(rimLeft, offsetY, rimWidth, 1);
  }

  // Rim side accents
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(rimLeft, rimTop, 1, rimBottom - rimTop + 1);
  ctx.fillRect(rimRight - 1, rimTop, 1, rimBottom - rimTop + 1);

  // Dark interior opening just below the rim
  const openingHeight = Math.max(1, rimBottom - interiorTop);
  ctx.fillStyle = '#0e0e0e';
  ctx.fillRect(interiorLeft, interiorTop, interiorWidth, openingHeight);

  // Vertical shaft descending into darkness
  const shaftTop = rimBottom;
  const shaftHeight = Math.max(0, canvasH - shaftTop);

  if (shaftHeight > 0) {
    ctx.fillStyle = '#060606';
    ctx.fillRect(interiorLeft, shaftTop, interiorWidth, shaftHeight);

    const brickInset = Math.max(1, Math.floor(interiorWidth * 0.12));
    const maxBrickWidth = interiorWidth - brickInset * 2;
    if (maxBrickWidth >= 2) {
      const brickWidth = Math.max(2, Math.floor(maxBrickWidth / 3));
      const leftBrickX = interiorLeft + brickInset;
      const centerBrickX = interiorLeft + Math.floor(interiorWidth / 2) - Math.floor(brickWidth / 2);
      const rightBrickX = interiorRight - brickInset - brickWidth;

      const worldShaftTop = groundY;
      const patternStep = BRICK_HEIGHT + BRICK_GAP;
      const worldStart = worldShaftTop + BRICK_GAP;
      const worldEnd = cameraY + canvasH;

      ctx.fillStyle = '#f5f5f5';
      let rowIndex = 0;
      for (let worldY = worldStart; worldY < worldEnd; worldY += patternStep, rowIndex += 1) {
        const screenY = Math.round(worldY - cameraY);
        const brickTop = Math.max(shaftTop, screenY);
        if (brickTop >= canvasH) break;

        const brickHeight = Math.min(BRICK_HEIGHT, canvasH - brickTop);
        if (brickHeight <= 0) continue;

        if (rowIndex % 2 === 0) {
          ctx.fillRect(leftBrickX, brickTop, brickWidth, brickHeight);
          ctx.fillRect(rightBrickX, brickTop, brickWidth, brickHeight);
        } else {
          ctx.fillRect(centerBrickX, brickTop, brickWidth, brickHeight);
        }
      }
    }
  }

  // Inner lip highlight to suggest depth
  ctx.fillStyle = '#3b3b3b';
  ctx.fillRect(interiorLeft, interiorTop, interiorWidth, 1);
}
