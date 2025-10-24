import {
  WELL_OPENING_WIDTH,
  WELL_RIM_THICKNESS,
  ensureWellDepth,
  getWellGeometry,
} from "../well_layout.js";
import type { WellGeometry } from "../well_layout.js";
import { CLIFF_CELL_SIZE, drawCavernCliffs } from "./drawCliffs.js";
import {
  flattenPolyominoEdge as flattenEdge,
  generatePolyomino,
  getPolyominoBounds,
  polyominoToOffsets,
  seededRandom,
} from "../geometry/polyomino.js";

const WELL_COLOR_RIM_CAP = "#f6f6fb";
const WELL_COLOR_RIM_COLLAR = "#d8dae4";
const WELL_COLOR_RIM_NOISE_TOP = "#e2e4ef";
const WELL_COLOR_RIM_NOISE_COLLAR = "#c4c6d3";
const WELL_COLOR_RIM_INNER_GLOW = "#3a3d47";
const WELL_COLOR_SHAFT = "#000000";
const WELL_COLOR_SHAFT_EDGE = "#3d4250";
const WELL_COLOR_SHAFT_ARM = "#2f3340";
const WELL_COLOR_WATER_SURFACE = "#1f82d0";
const WELL_COLOR_LIP = "#eceff5";
const WELL_COLOR_CAVERN = "#000000";

interface DrawWellOptions {
  centerX: number;
  groundY: number;
  cameraY: number;
  canvasHeight: number;
  openingWidth?: number;
}

interface WellRenderMetrics {
  rim: {
    left: number;
    right: number;
    outerTop: number;
    outerBottom: number;
    collarTop: number;
    collarBottom: number;
    innerTop: number;
    innerBottom: number;
    innerLeft: number;
    innerRight: number;
    outerWidth: number;
    innerWidth: number;
  };
  shaft: {
    interiorLeft: number;
    interiorRight: number;
    width: number;
    narrowTop: number;
    expansionTop: number;
    expansionBottom: number;
    bottom: number;
  };
  cavern: {
    cliffStart: number;
  };
  waterSurface: number;
  ground: number;
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
  options: ShaftEdgeOptions,
): void {
  const {
    innerLeft,
    innerWidth,
    top,
    bottom,
    canvasWidth,
    canvasHeight,
    seedBase,
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
  ctx.fillStyle = WELL_COLOR_SHAFT_EDGE;

  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const baseY = Math.round(clampedTop + t * verticalSpan);
    const anchorY = Math.min(baseY, clampedBottom - cellSize);

    {
      let cells = generatePolyomino(seedBase + i * 211, 3, 6);
      cells = flattenEdge(cells, "left");
      const bounds = getPolyominoBounds(cells);
      const outwardCells = 1 + Math.floor(seededRandom(seedBase + i * 503) * 2);
      const jitter = Math.round(
        (seededRandom(seedBase + i * 617) - 0.5) * cellSize,
      );
      const pxBase =
        leftBoundary - (bounds.maxX + outwardCells) * cellSize + jitter;
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
      cells = flattenEdge(cells, "right");
      const outwardCells = 1 + Math.floor(seededRandom(seedBase + i * 719) * 2);
      const jitter = Math.round(
        (seededRandom(seedBase + i * 829) - 0.5) * cellSize,
      );
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
  options: ShaftArmOptions,
): void {
  const {
    innerLeft,
    innerWidth,
    top,
    height,
    canvasWidth,
    canvasHeight,
    seedBase,
  } = options;

  if (!Number.isFinite(top) || !Number.isFinite(height)) return;

  const cellSize = CLIFF_CELL_SIZE;
  const leftBoundary = Math.round(innerLeft);
  const rightBoundary = Math.round(innerLeft + innerWidth);
  const clampedTop = Math.max(0, Math.floor(top));
  const clampedBottom = Math.min(canvasHeight, Math.ceil(top + height));
  if (clampedBottom - clampedTop < cellSize) return;

  ctx.save();
  ctx.fillStyle = WELL_COLOR_SHAFT_ARM;

  const drawCells = (
    side: "left" | "right",
    cells: ReturnType<typeof generatePolyomino>,
    baseX: number,
  ) => {
    const offsets = polyominoToOffsets(cells);
    for (const [cx, cy] of offsets) {
      const px = baseX + cx * cellSize;
      const py = clampedTop + cy * cellSize;
      if (px >= canvasWidth || px + cellSize <= 0) continue;
      if (py >= clampedBottom || py + cellSize <= clampedTop) continue;
      if (side === "left" && px >= leftBoundary) continue;
      if (side === "right" && px + cellSize <= rightBoundary) continue;

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
    side: "left" | "right";
    start: number;
    advance: (pxMin: number, pxMax: number) => number;
    limitReached: (pxMin: number, pxMax: number) => boolean;
    flatten: "left" | "right";
    seedOffset: number;
  }> = [
    {
      side: "left",
      start: leftBoundary,
      advance: (pxMin: number, _pxMax: number) => pxMin - cellSize,
      limitReached: (_pxMin: number, pxMax: number) => pxMax <= 0,
      flatten: "right",
      seedOffset: 0,
    },
    {
      side: "right",
      start: rightBoundary,
      advance: (_pxMin: number, pxMax: number) => pxMax + cellSize,
      limitReached: (pxMin: number, _pxMax: number) => pxMin >= canvasWidth,
      flatten: "left",
      seedOffset: 971,
    },
  ];

  for (const config of sides) {
    let cursor = config.start;
    let iteration = 0;

    while (iteration < 80) {
      let cells = generatePolyomino(
        seedBase + config.seedOffset + iteration * 53,
        5,
        11,
      );
      cells = flattenEdge(cells, "top");
      cells = flattenEdge(cells, config.flatten);
      const bounds = getPolyominoBounds(cells);
      const width = bounds.w * cellSize;

      const jitterSeed = seedBase + config.seedOffset + iteration * 71;
      const jitter = Math.round((seededRandom(jitterSeed) - 0.5) * cellSize);
      const baseX =
        config.side === "left" ? cursor - width + jitter : cursor + jitter;

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

interface RimPolyOptions {
  left: number;
  width: number;
  capTop: number;
  capBottom: number;
  collarTop: number;
  collarBottom: number;
  seedBase: number;
}

function drawRimPolyDetails(
  ctx: CanvasRenderingContext2D,
  options: RimPolyOptions,
): void {
  const { left, width, capTop, capBottom, collarTop, collarBottom, seedBase } =
    options;
  const cellSize = CLIFF_CELL_SIZE;
  const rightEdge = left + width;

  ctx.save();

  if (capBottom > capTop) {
    ctx.fillStyle = WELL_COLOR_RIM_NOISE_TOP;
    let x = left;
    let iteration = 0;
    while (x < rightEdge) {
      const seed = seedBase + iteration * 83;
      let cells = generatePolyomino(seed, 4, 9);
      cells = flattenEdge(cells, "bottom");
      const bounds = getPolyominoBounds(cells);
      const blockWidth = bounds.w * cellSize;
      const blockHeight = bounds.h * cellSize;
      const jitter = Math.round((seededRandom(seed + 17) - 0.5) * cellSize);
      const lift = Math.round(seededRandom(seed + 29) * cellSize * 0.5);
      const pxBase = Math.round(x) + jitter;
      const pyBase = capBottom - blockHeight - lift;

      for (const [cx, cy] of polyominoToOffsets(cells)) {
        const px = pxBase + cx * cellSize;
        const py = pyBase + cy * cellSize;
        const cellRight = px + cellSize;
        const cellBottom = py + cellSize;
        if (cellRight <= left || px >= rightEdge) continue;
        if (cellBottom <= capTop || py >= capBottom) continue;

        const drawX = Math.max(px, left);
        const drawWidth = Math.min(cellSize, rightEdge - drawX);
        if (drawWidth <= 0) continue;

        const drawTop = Math.max(py, capTop);
        const drawBottom = Math.min(cellBottom, capBottom);
        const drawHeight = drawBottom - drawTop;
        if (drawHeight <= 0) continue;

        ctx.fillRect(drawX, drawTop, drawWidth, drawHeight);
      }

      x += Math.max(cellSize, blockWidth - cellSize);
      iteration += 1;
    }
  }

  // Collar face band (adds subtle noise to the vertical surface)
  if (collarBottom > collarTop) {
    ctx.fillStyle = WELL_COLOR_RIM_NOISE_COLLAR;
    let x = left;
    let iteration = 0;
    while (x < rightEdge) {
      const seed = seedBase + 1000 + iteration * 97;
      let cells = generatePolyomino(seed, 4, 9);
      cells = flattenEdge(cells, "top");
      const bounds = getPolyominoBounds(cells);
      const blockWidth = bounds.w * cellSize;
      const blockHeight = bounds.h * cellSize;
      const jitter = Math.round((seededRandom(seed + 13) - 0.5) * cellSize);
      const pxBase = Math.round(x) + jitter;
      const pyBase = collarTop;

      for (const [cx, cy] of polyominoToOffsets(cells)) {
        const px = pxBase + cx * cellSize;
        const py = pyBase + cy * cellSize;
        const cellRight = px + cellSize;
        const cellBottom = py + cellSize;
        if (cellRight <= left || px >= rightEdge) continue;
        if (cellBottom <= collarTop || py >= collarBottom) continue;

        const drawX = Math.max(px, left);
        const drawWidth = Math.min(cellSize, rightEdge - drawX);
        if (drawWidth <= 0) continue;

        const drawTop = Math.max(py, collarTop);
        const drawBottom = Math.min(cellBottom, collarBottom);
        const drawHeight = drawBottom - drawTop;
        if (drawHeight <= 0) continue;

        ctx.fillRect(drawX, drawTop, drawWidth, drawHeight);
      }

      x += Math.max(cellSize, blockWidth - cellSize);
      iteration += 1;
    }
  }

  ctx.restore();
}

function projectWellGeometry(
  geometry: WellGeometry,
  cameraY: number,
): WellRenderMetrics {
  const toScreen = (worldY: number) => Math.round(worldY - cameraY);

  const rimLeft = Math.round(geometry.bounds.rimLeft);
  const rimRight = Math.round(geometry.bounds.rimRight);
  const innerLeft = Math.round(geometry.bounds.left);
  const innerRight = Math.round(geometry.bounds.right);

  const interiorLeft = Math.round(geometry.shaft.span.interiorLeft);
  const interiorRight = Math.round(geometry.shaft.span.interiorRight);

  const outerWidth = Math.max(0, rimRight - rimLeft);
  const innerWidth = Math.max(0, innerRight - innerLeft);

  return {
    rim: {
      left: rimLeft,
      right: rimRight,
      outerTop: toScreen(geometry.rim.outerTop),
      outerBottom: toScreen(geometry.rim.outerBottom),
      collarTop: toScreen(geometry.rim.collarTop),
      collarBottom: toScreen(geometry.rim.collarBottom),
      innerTop: toScreen(geometry.rim.innerTop),
      innerBottom: toScreen(geometry.rim.innerBottom),
      innerLeft,
      innerRight,
      outerWidth,
      innerWidth,
    },
    shaft: {
      interiorLeft,
      interiorRight,
      width: interiorRight - interiorLeft,
      narrowTop: toScreen(geometry.shaft.narrowTop),
      expansionTop: toScreen(geometry.shaft.expansionTop),
      expansionBottom: toScreen(geometry.shaft.expansionBottom),
      bottom: toScreen(geometry.shaft.bottom),
    },
    cavern: {
      cliffStart: toScreen(geometry.cavern.cliffStart),
    },
    waterSurface: toScreen(geometry.waterSurfaceY),
    ground: toScreen(geometry.rim.collarBottom),
  };
}

function drawWellRimBase(
  ctx: CanvasRenderingContext2D,
  rim: WellRenderMetrics["rim"],
): void {
  const rimCapHeight = rim.outerBottom - rim.outerTop;
  const collarHeight = rim.collarBottom - rim.collarTop;
  const collarLeft = rim.left + 1;
  const collarWidth = Math.max(0, rim.outerWidth - 2);

  if (rimCapHeight > 0) {
    ctx.fillStyle = WELL_COLOR_RIM_CAP;
    ctx.fillRect(rim.left, rim.outerTop, rim.outerWidth, rimCapHeight);
  }

  if (collarHeight > 0) {
    ctx.fillStyle = WELL_COLOR_RIM_COLLAR;
    ctx.fillRect(collarLeft, rim.collarTop, collarWidth, collarHeight);
  }

  const innerHeight = Math.max(0, rim.innerBottom - rim.innerTop);
  if (innerHeight > 0) {
    ctx.fillStyle = WELL_COLOR_SHAFT;
    ctx.fillRect(rim.innerLeft, rim.innerTop, rim.innerWidth, innerHeight);
  }
}

export function drawWell(
  ctx: CanvasRenderingContext2D,
  options: DrawWellOptions,
): void {
  const {
    centerX,
    groundY,
    cameraY,
    canvasHeight,
    openingWidth = WELL_OPENING_WIDTH,
  } = options;

  if (
    !Number.isFinite(centerX) ||
    !Number.isFinite(groundY) ||
    !Number.isFinite(cameraY)
  )
    return;
  if (!Number.isFinite(canvasHeight) || canvasHeight <= 0) return;

  const canvasWidth = ctx.canvas?.width ?? 0;
  if (!Number.isFinite(canvasWidth) || canvasWidth <= 0) return;

  ensureWellDepth(groundY, canvasHeight, cameraY + canvasHeight * 1.5);

  const normalizedOpeningWidth = Math.max(24, Math.round(openingWidth));
  const geometry = getWellGeometry(
    canvasWidth,
    canvasHeight,
    groundY,
    normalizedOpeningWidth,
  );
  const metrics = projectWellGeometry(geometry, cameraY);

  const rim = metrics.rim;
  const shaft = metrics.shaft;
  const cavern = metrics.cavern;
  const screenGroundY = metrics.ground;

  const rimOuterWidth = rim.outerWidth;
  const rimRight = rim.right;
  const verticalTop = Math.min(
    rim.outerTop - WELL_RIM_THICKNESS,
    rim.collarTop - WELL_RIM_THICKNESS,
  );
  const verticalBottom = Math.max(screenGroundY, shaft.bottom);
  const outsideHorizontal = rimRight < 0 || rim.left > canvasWidth;
  const outsideVertical = verticalBottom < 0 || verticalTop > canvasHeight;
  if (outsideHorizontal || outsideVertical) return;

  const innerHeight = Math.max(0, rim.innerBottom - rim.innerTop);

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillRect(
    rim.innerLeft - 1,
    rim.innerTop - 1,
    normalizedOpeningWidth + 2,
    innerHeight + 2,
  );
  ctx.restore();

  const shaftFillTop = Math.max(
    Math.round(geometry.rim.outerTop - WELL_RIM_THICKNESS - cameraY),
    0,
  );
  const shaftFillBottom = Math.min(shaft.bottom, canvasHeight);

  ctx.save();

  if (shaftFillBottom > shaftFillTop) {
    ctx.fillStyle = WELL_COLOR_SHAFT;
    ctx.fillRect(
      rim.innerLeft,
      shaftFillTop,
      normalizedOpeningWidth,
      shaftFillBottom - shaftFillTop,
    );
  }

  drawWellRimBase(ctx, rim);

  const rimSeedBase =
    Math.floor(centerX * 389) +
    Math.floor(groundY * 173) +
    Math.floor(canvasHeight);
  drawRimPolyDetails(ctx, {
    left: rim.left,
    width: rimOuterWidth,
    capTop: rim.outerTop,
    capBottom: rim.outerBottom,
    collarTop: rim.collarTop,
    collarBottom: rim.collarBottom,
    seedBase: rimSeedBase,
  });

  if (innerHeight > 0) {
    ctx.save();
    ctx.fillStyle = WELL_COLOR_RIM_INNER_GLOW;
    ctx.fillRect(
      rim.innerLeft,
      rim.innerTop,
      rim.innerWidth,
      Math.ceil(innerHeight * 0.45),
    );
    ctx.restore();
  }

  const lipHeight = Math.max(2, Math.round(WELL_RIM_THICKNESS / 2));
  ctx.fillStyle = WELL_COLOR_LIP;
  ctx.fillRect(rim.innerLeft, screenGroundY - lipHeight, rim.innerWidth, 1);

  ctx.restore();

  const shaftTextureTop = shaftFillTop + CLIFF_CELL_SIZE;
  const shaftTextureBottom = Math.min(shaftFillBottom, shaft.expansionTop);
  const shaftSeedBase =
    Math.floor(centerX * 977) +
    Math.floor(groundY * 613) +
    Math.floor(canvasHeight);

  if (shaftTextureBottom > shaftTextureTop) {
    drawWellShaftEdges(ctx, {
      innerLeft: rim.innerLeft,
      innerWidth: normalizedOpeningWidth,
      top: shaftTextureTop,
      bottom: shaftTextureBottom,
      canvasWidth,
      canvasHeight,
      seedBase: shaftSeedBase,
    });
  }

  drawWellShaftArms(ctx, {
    innerLeft: rim.innerLeft,
    innerWidth: normalizedOpeningWidth,
    top: shaft.expansionTop - CLIFF_CELL_SIZE * 2,
    height: CLIFF_CELL_SIZE * 2,
    canvasWidth,
    canvasHeight,
    seedBase: shaftSeedBase + 3571,
  });

  if (shaft.expansionBottom > 0 && shaft.expansionTop < canvasHeight) {
    const cavernDrawTop = Math.max(shaft.expansionTop, 0);
    const cavernDrawBottom = Math.min(shaft.expansionBottom, canvasHeight);
    if (cavernDrawBottom > cavernDrawTop) {
      ctx.fillStyle = WELL_COLOR_CAVERN;
      ctx.fillRect(
        0,
        cavernDrawTop,
        canvasWidth,
        cavernDrawBottom - cavernDrawTop,
      );

      if (geometry.cavern.cliffStart < geometry.shaft.expansionBottom) {
        drawCavernCliffs(ctx, {
          canvasWidth,
          canvasHeight,
          cameraY,
          cavernTop: geometry.cavern.cliffStart,
          cavernBottom: geometry.shaft.expansionBottom,
        });
      }
    }
  }

  const waterSurface = metrics.waterSurface;
  if (waterSurface >= 0 && waterSurface <= canvasHeight) {
    const waterLineThickness = 2;
    const waterTop = Math.max(
      0,
      waterSurface - Math.floor(waterLineThickness / 2),
    );
    const waterHeight = Math.min(waterLineThickness, canvasHeight - waterTop);
    if (waterHeight > 0) {
      ctx.save();
      ctx.fillStyle = WELL_COLOR_WATER_SURFACE;
      ctx.fillRect(0, waterTop, canvasWidth, waterHeight);
      ctx.restore();
    }
  }

  if (shaft.expansionBottom >= 0 && shaft.expansionBottom <= canvasHeight) {
    ctx.fillStyle = WELL_COLOR_CAVERN;
    ctx.fillRect(0, shaft.expansionBottom - 1, canvasWidth, 1);
  }
}
