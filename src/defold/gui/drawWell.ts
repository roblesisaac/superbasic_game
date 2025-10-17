import { SPRITE_SIZE } from '../../config/constants.js';

interface DrawWellOptions {
  centerX: number;
  groundY: number;
  cameraY: number;
  canvasHeight: number;
  openingWidth?: number;
}

const DEFAULT_OPENING_WIDTH = SPRITE_SIZE * 2;
const RIM_THICKNESS = 4;
const WALL_HEIGHT = 8;

function clampToCanvasBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  canvasWidth: number,
  canvasHeight: number
): boolean {
  if (width <= 0 || height <= 0) return false;
  if (x + width < 0 || x > canvasWidth) return false;
  if (y > canvasHeight) return false;
  if (y + height < 0) return false;
  return true;
}

export function drawWell(ctx: CanvasRenderingContext2D, options: DrawWellOptions): void {
  const { centerX, groundY, cameraY, canvasHeight, openingWidth = DEFAULT_OPENING_WIDTH } = options;

  if (!Number.isFinite(centerX) || !Number.isFinite(groundY) || !Number.isFinite(cameraY)) return;
  if (!Number.isFinite(canvasHeight) || canvasHeight <= 0) return;

  const normalizedOpeningWidth = Math.max(24, Math.round(openingWidth));
  const screenGroundY = Math.round(groundY - cameraY);
  const canvasWidth = ctx.canvas?.width ?? 0;

  if (!clampToCanvasBounds(centerX - normalizedOpeningWidth, screenGroundY - WALL_HEIGHT - RIM_THICKNESS, normalizedOpeningWidth * 2, canvasHeight, canvasWidth, canvasHeight)) {
    return;
  }

  const rimOuterWidth = normalizedOpeningWidth + RIM_THICKNESS * 2;
  const rimLeft = Math.round(centerX - rimOuterWidth / 2);
  const rimTop = screenGroundY - (RIM_THICKNESS + 1);

  ctx.save();
  ctx.fillStyle = '#fff';

  // Draw the rim cap
  ctx.fillRect(rimLeft, rimTop - RIM_THICKNESS, rimOuterWidth, RIM_THICKNESS);

  // Draw the rim collar overlapping the ground line for a pipe-like look
  const collarHeight = WALL_HEIGHT;
  const collarLeft = rimLeft + 1;
  const collarWidth = rimOuterWidth - 2;
  ctx.fillRect(collarLeft, screenGroundY - collarHeight, collarWidth, collarHeight);

  // Darken the inner lip to give depth
  const innerLeft = Math.round(centerX - normalizedOpeningWidth / 2);
  const innerTop = screenGroundY - Math.max(2, Math.floor(RIM_THICKNESS / 2)) - 1;
  const innerHeight = collarHeight + RIM_THICKNESS;

  ctx.fillStyle = '#000';
  ctx.fillRect(innerLeft, innerTop, normalizedOpeningWidth, innerHeight);

  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.25;
  ctx.fillRect(innerLeft, innerTop, normalizedOpeningWidth, Math.ceil(innerHeight * 0.45));
  ctx.globalAlpha = 1;

  // Draw shaft guide lines extending downward
  const shaftBottom = canvasHeight;
  const lineTop = Math.min(screenGroundY, shaftBottom);
  const shaftLines = [
    innerLeft + 1,
    innerLeft + normalizedOpeningWidth - 2
  ];

  for (const x of shaftLines) {
    if (x < 0 || x >= canvasWidth) continue;
    if (lineTop >= shaftBottom) continue;
    ctx.fillRect(Math.round(x), lineTop, 1, shaftBottom - lineTop);
  }

  // Reinforce the inner edge with a subtle highlight for a cylindrical feel
  const lipHeight = Math.max(2, Math.round(RIM_THICKNESS / 2));
  ctx.fillRect(innerLeft, screenGroundY - lipHeight, normalizedOpeningWidth, 1);

  ctx.restore();
}
