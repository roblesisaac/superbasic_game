import {
  WELL_COLLAR_HEIGHT,
  WELL_OPENING_WIDTH,
  WELL_RIM_THICKNESS,
  getWellExpansionBottomY,
  getWellExpansionTopY,
  getWellShaftBottomY,
  getWellWaterSurfaceY,
  ensureWellDepth,
  getCliffStartY
} from '../runtime/environment/well_layout.js';
import {
  CLIFF_CELL_SIZE,
  drawCavernCliffs
} from './drawCliffs.js';
import {
  flattenPolyominoEdge as flattenEdge,
  generatePolyomino,
  getPolyominoBounds,
  polyominoToOffsets,
  seededRandom
} from '../modules/polyomino.js';

interface DrawWellOptions {
  centerX: number;
  groundY: number;
  cameraY: number;
  canvasHeight: number;
  openingWidth?: number;
}

interface ShaftEdgeOptions {
  innerLeft: number;
  innerWidth: number;
  top: number;
  bottom: number;
  canvasWidth: number;
  canvasHeight: number;
  seedBase: number;
}

function drawWellShaftEdges(
  ctx: CanvasRenderingContext2D,
  options: ShaftEdgeOptions
): void {
  const {
    innerLeft,
    innerWidth,
    top,
    bottom,
    canvasWidth,
    canvasHeight,
    seedBase
  } = options;

  if (!Number.isFinite(innerLeft) || !Number.isFinite(innerWidth)) return;
  if (innerWidth <= CLIFF_CELL_SIZE) return;

  const cellSize = CLIFF_CELL_SIZE;
  const clampedTop = Math.max(0, Math.floor(top));
  const clampedBottom = Math.min(canvasHeight, Math.ceil(bottom));
  if (clampedBottom - clampedTop < cellSize) return;

  const verticalSpan = clampedBottom - clampedTop;
  const sampleStride = cellSize * 4;
  const steps = Math.max(1, Math.ceil(verticalSpan / sampleStride));
  const leftBoundary = Math.round(innerLeft);
  const rightBoundary = Math.round(innerLeft + innerWidth);

  ctx.save();
  ctx.fillStyle = '#fff'; // well shaft texture
  ctx.globalAlpha = .3;

  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const baseY = Math.round(clampedTop + t * verticalSpan);
    const anchorY = Math.min(baseY, clampedBottom - cellSize);

    {
      let cells = generatePolyomino(seedBase + i * 211, 3, 6);
      cells = flattenEdge(cells, 'left');
      const bounds = getPolyominoBounds(cells);
      const outwardCells = 1 + Math.floor(seededRandom(seedBase + i * 503) * 2);
      const jitter = Math.round((seededRandom(seedBase + i * 617) - 0.5) * cellSize);
      const pxBase = leftBoundary - (bounds.maxX + outwardCells) * cellSize + jitter;
      const offsets = polyominoToOffsets(cells);

      for (const [cx, cy] of offsets) {
        const px = pxBase + cx * cellSize;
        if (px >= leftBoundary) continue;
        if (px + cellSize <= 0) continue;

        const py = anchorY + cy * cellSize;
        if (py >= clampedBottom || py + cellSize <= clampedTop) continue;

        const drawTop = Math.max(py, clampedTop);
        const drawHeight = Math.min(cellSize, clampedBottom - drawTop);
        const drawX = Math.max(px, 0);
        const drawWidth = Math.min(cellSize, leftBoundary - drawX);
        if (drawHeight > 0 && drawWidth > 0) {
          ctx.fillRect(drawX, drawTop, drawWidth, drawHeight);
        }
      }
    }

    {
      let cells = generatePolyomino(seedBase + i * 211 + 97, 3, 6);
      cells = flattenEdge(cells, 'right');
      const outwardCells = 1 + Math.floor(seededRandom(seedBase + i * 719) * 2);
      const jitter = Math.round((seededRandom(seedBase + i * 829) - 0.5) * cellSize);
      const pxBase = rightBoundary + cellSize * outwardCells + jitter;
      const offsets = polyominoToOffsets(cells);

      for (const [cx, cy] of offsets) {
        const px = pxBase + cx * cellSize;
        if (px + cellSize <= rightBoundary) continue;
        if (px >= canvasWidth) continue;

        const py = anchorY + cy * cellSize;
        if (py >= clampedBottom || py + cellSize <= clampedTop) continue;

        const drawTop = Math.max(py, clampedTop);
        const drawHeight = Math.min(cellSize, clampedBottom - drawTop);
        const drawX = Math.max(px, rightBoundary);
        const drawWidth = Math.min(cellSize, canvasWidth - drawX);
        if (drawHeight > 0 && drawWidth > 0) {
          ctx.fillRect(drawX, drawTop, drawWidth, drawHeight);
        }
      }
    }
  }

  ctx.restore();
}

interface ShaftArmOptions {
  innerLeft: number;
  innerWidth: number;
  top: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
  seedBase: number;
}

function drawWellShaftArms(
  ctx: CanvasRenderingContext2D,
  options: ShaftArmOptions
): void {
  const {
    innerLeft,
    innerWidth,
    top,
    height,
    canvasWidth,
    canvasHeight,
    seedBase
  } = options;

  if (!Number.isFinite(top) || !Number.isFinite(height)) return;

  const cellSize = CLIFF_CELL_SIZE;
  const leftBoundary = Math.round(innerLeft);
  const rightBoundary = Math.round(innerLeft + innerWidth);
  const clampedTop = Math.max(0, Math.floor(top));
  const clampedBottom = Math.min(canvasHeight, Math.ceil(top + height));
  if (clampedBottom - clampedTop < cellSize) return;

  ctx.save();
  ctx.fillStyle = '#fff'; // well shaft arms extending to screen edge
  ctx.globalAlpha = 0.35;

  const drawCells = (
    side: 'left' | 'right',
    cells: ReturnType<typeof generatePolyomino>,
    baseX: number
  ) => {
    const offsets = polyominoToOffsets(cells);
    for (const [cx, cy] of offsets) {
      const px = baseX + cx * cellSize;
      const py = clampedTop + cy * cellSize;
      if (px >= canvasWidth || px + cellSize <= 0) continue;
      if (py >= clampedBottom || py + cellSize <= clampedTop) continue;
      if (side === 'left' && px >= leftBoundary) continue;
      if (side === 'right' && px + cellSize <= rightBoundary) continue;

      const drawX = Math.max(px, 0);
      const drawWidth = Math.min(cellSize, canvasWidth - drawX);
      if (drawWidth <= 0) continue;

      const drawTop = Math.max(py, clampedTop);
      const drawBottom = Math.min(py + cellSize, clampedBottom);
      const drawHeight = drawBottom - drawTop;
      if (drawHeight <= 0) continue;

      ctx.fillRect(drawX, drawTop, drawWidth, drawHeight);
    }
  };

  const sides: Array<{
    side: 'left' | 'right';
    start: number;
    advance: (pxMin: number, pxMax: number) => number;
    limitReached: (pxMin: number, pxMax: number) => boolean;
    flatten: 'left' | 'right';
    seedOffset: number;
  }> = [
    {
      side: 'left',
      start: leftBoundary,
    advance: (pxMin: number, _pxMax: number) => pxMin - cellSize,
    limitReached: (_pxMin: number, pxMax: number) => pxMax <= 0,
      flatten: 'right',
      seedOffset: 0
    },
    {
      side: 'right',
      start: rightBoundary,
    advance: (_pxMin: number, pxMax: number) => pxMax + cellSize,
    limitReached: (pxMin: number, _pxMax: number) => pxMin >= canvasWidth,
      flatten: 'left',
      seedOffset: 971
    }
  ];

  for (const config of sides) {
    let cursor = config.start;
    let iteration = 0;

    while (iteration < 80) {
      let cells = generatePolyomino(seedBase + config.seedOffset + iteration * 53, 5, 11);
      cells = flattenEdge(cells, 'top');
      cells = flattenEdge(cells, config.flatten);
      const bounds = getPolyominoBounds(cells);
      const width = bounds.w * cellSize;

      const jitterSeed = seedBase + config.seedOffset + iteration * 71;
      const jitter = Math.round((seededRandom(jitterSeed) - 0.5) * cellSize);
      const baseX =
        config.side === 'left'
          ? cursor - width + jitter
          : cursor + jitter;

      drawCells(config.side, cells, baseX);

      const pxMin = baseX;
      const pxMax = baseX + width;
      if (config.limitReached(pxMin, pxMax)) break;

      cursor = config.advance(pxMin, pxMax);
      iteration += 1;
    }
  }

  ctx.restore();
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
  const cliffStartWorld = getCliffStartY(groundY, canvasHeight);
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

  const shaftFillTop = Math.max(rimTop - WELL_RIM_THICKNESS, 0);
  const shaftFillBottom = Math.min(shaftBottomScreen, canvasHeight);
  if (shaftFillBottom > shaftFillTop) {
    ctx.fillStyle = '#000';
    ctx.fillRect(innerLeft, shaftFillTop, normalizedOpeningWidth, shaftFillBottom - shaftFillTop);
  }

  ctx.fillStyle = '#777';

  // Draw the rim cap
  ctx.fillRect(rimLeft, rimTop - WELL_RIM_THICKNESS, rimOuterWidth, WELL_RIM_THICKNESS);

  // Draw the rim collar overlapping the ground line for a pipe-like look
  const collarHeight = WELL_COLLAR_HEIGHT;
  const collarLeft = rimLeft + 1;
  const collarWidth = rimOuterWidth - 2;
  ctx.fillRect(collarLeft, screenGroundY - collarHeight, collarWidth, collarHeight);

  // Darken the inner lip to give depth
  ctx.fillStyle = '#111';
  ctx.fillRect(innerLeft, innerTop, normalizedOpeningWidth, innerHeight);

  ctx.fillStyle = '#111';
  ctx.globalAlpha = 1;
  ctx.fillRect(innerLeft, innerTop, normalizedOpeningWidth, Math.ceil(innerHeight * 0.45));
  ctx.globalAlpha = 1;

  const shaftTextureTop = shaftFillTop + CLIFF_CELL_SIZE;
  const shaftTextureBottom = Number.isFinite(expansionTopScreen)
    ? Math.min(shaftFillBottom, expansionTopScreen)
    : shaftFillBottom;
  const shaftSeedBase =
    Math.floor(centerX * 977) + Math.floor(groundY * 613) + Math.floor(canvasHeight);
  if (shaftTextureBottom > shaftTextureTop) {
    drawWellShaftEdges(ctx, {
      innerLeft,
      innerWidth: normalizedOpeningWidth,
      top: shaftTextureTop,
      bottom: shaftTextureBottom,
      canvasWidth,
      canvasHeight,
      seedBase: shaftSeedBase
    });
  }

  // Paint the wider cavern section with subtle mortar bands for texture
  if (expansionBottomScreen > 0 && expansionTopScreen < canvasHeight) {
    const cavernDrawTop = Math.max(expansionTopScreen, 0);
    const cavernDrawBottom = Math.min(expansionBottomScreen, canvasHeight);
    if (cavernDrawBottom > cavernDrawTop) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, cavernDrawTop, canvasWidth, cavernDrawBottom - cavernDrawTop);

      if (cliffStartWorld < expansionBottomWorld) {
        drawCavernCliffs(ctx, {
          canvasWidth,
          canvasHeight,
          cameraY,
          cavernTop: cliffStartWorld,
          cavernBottom: expansionBottomWorld
        });
      }

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

  // Cap the shaft where it opens into the wider cavern by forming polyomino
  // “L” shapes that frame the narrow shaft.
  if (Number.isFinite(expansionTopScreen)) {
    const armHeight = CLIFF_CELL_SIZE * 2;
    const armTop = Math.round((expansionTopScreen ?? 0) - armHeight);
    const armSeedBase = shaftSeedBase + 3571;
    drawWellShaftArms(ctx, {
      innerLeft,
      innerWidth: normalizedOpeningWidth,
      top: armTop,
      height: armHeight,
      canvasWidth,
      canvasHeight,
      seedBase: armSeedBase
    });
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
