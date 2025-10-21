import {
  WELL_COLLAR_HEIGHT,
  WELL_OPENING_WIDTH,
  WELL_RIM_THICKNESS,
  WELL_SHAFT_COLUMN_INSET,
  WELL_SHAFT_COLUMN_WIDTH,
  getWellExpansionBottomY,
  getWellExpansionTopY,
  getWellShaftBottomY,
  getWellWaterSurfaceY,
  ensureWellDepth
} from '../runtime/environment/well_layout.js';
import { drawCavernCliffs } from './drawCliffs.js';

interface DrawWellOptions {
  centerX: number;
  groundY: number;
  cameraY: number;
  canvasHeight: number;
  openingWidth?: number;
}

export function drawWell(ctx: CanvasRenderingContext2D, options: DrawWellOptions): void {
  const { centerX, groundY, cameraY, canvasHeight, openingWidth = WELL_OPENING_WIDTH } = options;

  if (!Number.isFinite(centerX) || !Number.isFinite(groundY) || !Number.isFinite(cameraY)) return;
  if (!Number.isFinite(canvasHeight) || canvasHeight <= 0) return;

  ensureWellDepth(groundY, canvasHeight, cameraY + canvasHeight * 1.5);

  const normalizedOpeningWidth = Math.max(24, Math.round(openingWidth));
  const screenGroundY = Math.round(groundY - cameraY);
  const shaftBottomWorld = getWellShaftBottomY(groundY, canvasHeight);
  const expansionTopWorld = getWellExpansionTopY(groundY, canvasHeight);
  const expansionBottomWorld = getWellExpansionBottomY(groundY, canvasHeight);
  const waterSurfaceWorld = getWellWaterSurfaceY(groundY, canvasHeight);
  const shaftBottomScreen = Math.round(shaftBottomWorld - cameraY);
  const expansionTopScreen = Math.round(expansionTopWorld - cameraY);
  const expansionBottomScreen = Math.round(expansionBottomWorld - cameraY);
  const waterSurfaceScreen = Math.round(waterSurfaceWorld - cameraY);
  const canvasWidth = ctx.canvas?.width ?? 0;

  const rimOuterWidth = normalizedOpeningWidth + WELL_RIM_THICKNESS * 2;
  const rimLeft = Math.round(centerX - rimOuterWidth / 2);
  const rimTop = screenGroundY - (WELL_RIM_THICKNESS + 1);

  const verticalTop = Math.min(rimTop - WELL_RIM_THICKNESS, screenGroundY - WELL_COLLAR_HEIGHT - WELL_RIM_THICKNESS);
  const verticalBottom = Math.max(screenGroundY, shaftBottomScreen);
  const outsideHorizontal = rimLeft + rimOuterWidth < 0 || rimLeft > canvasWidth;
  const outsideVertical = verticalBottom < 0 || verticalTop > canvasHeight;
  if (outsideHorizontal || outsideVertical) return;

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

  const shaftFillTop = Math.max(rimTop - WELL_RIM_THICKNESS, 0);
  const shaftFillBottom = Math.min(shaftBottomScreen, canvasHeight);
  if (shaftFillBottom > shaftFillTop) {
    ctx.fillStyle = '#000';
    ctx.fillRect(innerLeft, shaftFillTop, normalizedOpeningWidth, shaftFillBottom - shaftFillTop);
  }

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
  const columnTop = Math.max(0, Math.min(screenGroundY, canvasHeight));
  const columnBottomLimit = Math.min(expansionTopScreen - 1, shaftBottomScreen);
  const columnBottom = Math.min(Math.max(columnBottomLimit, 0), canvasHeight);
  const brickSize = WELL_SHAFT_COLUMN_WIDTH;
  const brickGap = 1;
  const columnInset = WELL_SHAFT_COLUMN_INSET;
  const brickColumns = [
    innerLeft + columnInset,
    innerLeft + normalizedOpeningWidth - columnInset - brickSize
  ];

  for (const columnX of brickColumns) {
    if (columnX + brickSize <= 0 || columnX >= canvasWidth) continue;
    if (columnBottom <= columnTop) continue;

    for (let y = columnTop; y < columnBottom; y += brickSize + brickGap) {
      const drawHeight = Math.min(brickSize, columnBottom - y);
      ctx.fillRect(Math.round(columnX), Math.round(y), brickSize, drawHeight);
    }
  }

  // Paint the wider cavern section with subtle mortar bands for texture
  if (expansionBottomScreen > 0 && expansionTopScreen < canvasHeight) {
    const cavernDrawTop = Math.max(expansionTopScreen, 0);
    const cavernDrawBottom = Math.min(expansionBottomScreen, canvasHeight);
    if (cavernDrawBottom > cavernDrawTop) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, cavernDrawTop, canvasWidth, cavernDrawBottom - cavernDrawTop);

      drawCavernCliffs(ctx, {
        canvasWidth,
        canvasHeight,
        cameraY,
        cavernTop: expansionTopWorld,
        cavernBottom: expansionBottomWorld
      });

      ctx.fillStyle = '#fff';
    }
  }

  if (waterSurfaceScreen >= 0 && waterSurfaceScreen <= canvasHeight) {
    const waterLineThickness = 2;
    const waterTop = Math.max(0, waterSurfaceScreen - Math.floor(waterLineThickness / 2));
    const waterHeight = Math.min(waterLineThickness, canvasHeight - waterTop);
    if (waterHeight > 0) {
      ctx.fillStyle = '#2a9df4';
      ctx.globalAlpha = 0.8;
      ctx.fillRect(0, waterTop, canvasWidth, waterHeight);
      ctx.globalAlpha = 1;
    }
  }

  // Cap the shaft where it opens into the wider cavern by bending each guide
  // column outward so they form retro "L" shapes that frame the opening.
  ctx.fillStyle = '#fff';
  if (Number.isFinite(expansionTopScreen)) {
    const armHeight = brickSize;
    const armTop = Math.round(expansionTopScreen - armHeight);
    const drawTop = Math.max(armTop, 0);
    const drawBottom = Math.min(armTop + armHeight, canvasHeight);
    if (drawBottom > drawTop) {
      const height = drawBottom - drawTop;
      const leftColumnX = Math.round(brickColumns[0] ?? innerLeft + columnInset);
      const rightColumnX = Math.round(brickColumns[1] ?? innerLeft + normalizedOpeningWidth - columnInset - brickSize);

      const leftArmEnd = Math.max(0, leftColumnX + brickSize);
      for (let x = leftArmEnd - brickSize; x >= 0; x -= brickSize + brickGap) {
        const drawX = Math.max(x, 0);
        const drawWidth = Math.min(brickSize, leftArmEnd - drawX);
        if (drawWidth <= 0) continue;
        ctx.fillRect(drawX, drawTop, drawWidth, height);
      }

      const rightArmStart = Math.max(0, rightColumnX);
      for (let x = rightArmStart; x < canvasWidth; x += brickSize + brickGap) {
        const drawWidth = Math.min(brickSize, canvasWidth - x);
        if (drawWidth <= 0) break;
        ctx.fillRect(Math.round(x), drawTop, drawWidth, height);
      }
    }
  }

  // Reinforce the cavern floor with a bright edge to signify a stable landing surface
  if (expansionBottomScreen >= 0 && expansionBottomScreen <= canvasHeight) {
    ctx.fillRect(0, expansionBottomScreen - 1, canvasWidth, 1);
  }

  // Reinforce the inner edge with a subtle highlight for a cylindrical feel
  const lipHeight = Math.max(2, Math.round(WELL_RIM_THICKNESS / 2));
  ctx.fillRect(innerLeft, screenGroundY - lipHeight, normalizedOpeningWidth, 1);

  ctx.restore();
}
