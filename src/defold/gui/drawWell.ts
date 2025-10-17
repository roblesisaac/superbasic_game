import {
  WELL_COLLAR_HEIGHT,
  WELL_OPENING_WIDTH,
  WELL_RIM_THICKNESS,
  WELL_SHAFT_COLUMN_INSET,
  WELL_SHAFT_COLUMN_WIDTH
} from '../runtime/environment/well_layout.js';

interface DrawWellOptions {
  centerX: number;
  groundY: number;
  cameraY: number;
  canvasHeight: number;
  openingWidth?: number;
}

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
  const { centerX, groundY, cameraY, canvasHeight, openingWidth = WELL_OPENING_WIDTH } = options;

  if (!Number.isFinite(centerX) || !Number.isFinite(groundY) || !Number.isFinite(cameraY)) return;
  if (!Number.isFinite(canvasHeight) || canvasHeight <= 0) return;

  const normalizedOpeningWidth = Math.max(24, Math.round(openingWidth));
  const screenGroundY = Math.round(groundY - cameraY);
  const canvasWidth = ctx.canvas?.width ?? 0;

  if (!clampToCanvasBounds(centerX - normalizedOpeningWidth, screenGroundY - WELL_COLLAR_HEIGHT - WELL_RIM_THICKNESS, normalizedOpeningWidth * 2, canvasHeight, canvasWidth, canvasHeight)) {
    return;
  }

  const rimOuterWidth = normalizedOpeningWidth + WELL_RIM_THICKNESS * 2;
  const rimLeft = Math.round(centerX - rimOuterWidth / 2);
  const rimTop = screenGroundY - (WELL_RIM_THICKNESS + 1);

  const innerLeft = Math.round(centerX - normalizedOpeningWidth / 2);
  const innerTop = screenGroundY - Math.max(2, Math.floor(WELL_RIM_THICKNESS / 2)) - 1;
  const innerHeight = WELL_COLLAR_HEIGHT + WELL_RIM_THICKNESS;

  ctx.save();

  // Ensure grass and ground details behind the rim opening are cleared before painting the well
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(
    innerLeft - 1,
    innerTop - 1,
    normalizedOpeningWidth + 2,
    innerHeight + 2
  );
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#fff';

  // Draw the rim cap
  ctx.fillRect(rimLeft, rimTop - WELL_RIM_THICKNESS, rimOuterWidth, WELL_RIM_THICKNESS);

  // Draw the rim collar overlapping the ground line for a pipe-like look
  const collarHeight = WELL_COLLAR_HEIGHT;
  const collarLeft = rimLeft + 1;
  const collarWidth = rimOuterWidth - 2;
  ctx.fillRect(collarLeft, screenGroundY - collarHeight, collarWidth, collarHeight);

  // Darken the inner lip to give depth
  ctx.fillStyle = '#000';
  ctx.fillRect(innerLeft, innerTop, normalizedOpeningWidth, innerHeight);

  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.25;
  ctx.fillRect(innerLeft, innerTop, normalizedOpeningWidth, Math.ceil(innerHeight * 0.45));
  ctx.globalAlpha = 1;

  // Draw shaft guide bricks extending downward
  const shaftBottom = canvasHeight;
  const lineTop = Math.min(screenGroundY, shaftBottom);
  const brickSize = WELL_SHAFT_COLUMN_WIDTH;
  const brickGap = 1;
  const columnInset = WELL_SHAFT_COLUMN_INSET;
  const brickColumns = [
    innerLeft + columnInset,
    innerLeft + normalizedOpeningWidth - columnInset - brickSize
  ];

  for (const columnX of brickColumns) {
    if (columnX + brickSize <= 0 || columnX >= canvasWidth) continue;
    if (lineTop >= shaftBottom) continue;

    for (let y = lineTop; y < shaftBottom; y += brickSize + brickGap) {
      const drawHeight = Math.min(brickSize, shaftBottom - y);
      ctx.fillRect(Math.round(columnX), Math.round(y), brickSize, drawHeight);
    }
  }

  // Reinforce the inner edge with a subtle highlight for a cylindrical feel
  const lipHeight = Math.max(2, Math.round(WELL_RIM_THICKNESS / 2));
  ctx.fillRect(innerLeft, screenGroundY - lipHeight, normalizedOpeningWidth, 1);

  ctx.restore();
}
