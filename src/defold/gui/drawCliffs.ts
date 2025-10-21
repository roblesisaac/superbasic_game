type CliffSide = 'left' | 'right';
type Edge = 'left' | 'right' | 'top' | 'bottom';

const CELL_SIZE = 2;
const USE_OFFSCREEN_CANVAS = false;
const MAX_WIDTH_RATIO = 0.3;
const LEDGE_THRESHOLD_RATIO = 0.1;
const LEDGE_WIDTH_RATIO = 0.3;
const SEGMENT_HEIGHT = 240;
const BUFFER_SEGMENTS = 4;
const CLIFF_CLEARANCE = CELL_SIZE * 2;
const CLIFF_LEDGE_THICKNESS = CELL_SIZE * 3;

type PolyominoCellSet = Set<string>;
type PolyominoOffsets = Array<readonly [number, number]>;

export interface CliffLedge {
  left: number;
  right: number;
  y: number;
}

export const CLIFF_CELL_SIZE = CELL_SIZE;
export const CLIFF_LEDGE_TOLERANCE = CLIFF_LEDGE_THICKNESS;

interface HorizontalCacheEntry {
  offsetX: number;
  offsetY: number;
  cells: PolyominoOffsets;
}

interface VerticalCacheEntry {
  t: number;
  anchor: Edge;
  widthPixels: number;
  cells: PolyominoOffsets;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function randInt(min: number, max: number, seed: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

function generatePolyomino(
  seed: number,
  minSize = 4,
  maxSize = 9
): PolyominoCellSet {
  const target = randInt(minSize, maxSize, seed);
  const cells = new Set<string>(['0,0']);
  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  let attempts = 0;
  while (cells.size < target && attempts < target * 10) {
    const arr = Array.from(cells);
    const anchorIndex = randInt(0, arr.length - 1, seed + attempts);
    const [x, y] = arr[anchorIndex]?.split(',').map(Number) ?? [0, 0];
    const dirIndex = randInt(0, dirs.length - 1, seed + attempts + 1000);
    const [dx, dy] = dirs[dirIndex];
    const nx = x + dx;
    const ny = y + dy;
    const key = `${nx},${ny}`;
    if (!cells.has(key)) cells.add(key);
    attempts += 1;
  }

  let minX = Infinity;
  let minY = Infinity;
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }

  const normalized = new Set<string>();
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    normalized.add(`${x - minX},${y - minY}`);
  }

  return normalized;
}

function getBounds(cells: PolyominoCellSet) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function flattenEdge(cells: PolyominoCellSet, side: Edge): PolyominoCellSet {
  const bounds = getBounds(cells);
  const map = new Map<number, number[]>();

  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    const primary = side === 'top' || side === 'bottom' ? x : y;
    const secondary = side === 'top' || side === 'bottom' ? y : x;
    const arr = map.get(primary);
    if (arr) arr.push(secondary);
    else map.set(primary, [secondary]);
  }

  const addCell = (x: number, y: number) => cells.add(`${x},${y}`);

  if (side === 'right') {
    for (let y = 0; y < bounds.h; y += 1) {
      const arr = map.get(y) ?? [];
      const max = arr.length ? Math.max(...arr) : -Infinity;
      for (let x = max + 1; x <= bounds.maxX; x += 1) addCell(x, y);
    }
  } else if (side === 'left') {
    for (let y = 0; y < bounds.h; y += 1) {
      const arr = map.get(y) ?? [];
      const min = arr.length ? Math.min(...arr) : Infinity;
      const limit = Number.isFinite(min) ? min - 1 : bounds.maxX;
      for (let x = 0; x <= limit; x += 1) addCell(x, y);
    }
  } else if (side === 'top') {
    for (let x = 0; x < bounds.w; x += 1) {
      const arr = map.get(x) ?? [];
      const min = arr.length ? Math.min(...arr) : Infinity;
      const limit = Number.isFinite(min) ? min - 1 : bounds.maxY;
      for (let y = 0; y <= limit; y += 1) addCell(x, y);
    }
  } else if (side === 'bottom') {
    for (let x = 0; x < bounds.w; x += 1) {
      const arr = map.get(x) ?? [];
      const max = arr.length ? Math.max(...arr) : -Infinity;
      for (let y = max + 1; y <= bounds.maxY; y += 1) addCell(x, y);
    }
  }

  return cells;
}

class CliffSegment {
  side: CliffSide;
  y: number;
  height: number;
  currentWidth: number;
  endWidth: number;
  horizontalLen: number;
  moveInward: boolean;
  verticalLen: number;
  angle: number;
  isLedge: boolean;
  isPreLedge: boolean;
  hasArc: boolean;
  arcAmount: number;
  seedBase: number;
  canvasWidth: number;
  horizontalCache: HorizontalCacheEntry[] | null;
  verticalCache: VerticalCacheEntry[] | null;
  controlX: number | null;
  controlY: number | null;

  constructor(
    side: CliffSide,
    prevSegment: CliffSegment | null,
    canvasWidth: number,
    seedBase: number
  ) {
    this.side = side;
    this.seedBase = seedBase;
    this.canvasWidth = canvasWidth;

    const maxWidth = canvasWidth * MAX_WIDTH_RATIO;
    const ledgeThreshold = canvasWidth * LEDGE_THRESHOLD_RATIO;
    const ledgeWidth = canvasWidth * LEDGE_WIDTH_RATIO;

    this.hasArc = seededRandom(seedBase + 8888) < 0.15;
    this.arcAmount = this.hasArc ? seededRandom(seedBase + 9999) * 50 + 50 : 0;
    this.horizontalCache = null;
    this.verticalCache = null;
    this.controlX = null;
    this.controlY = null;

    if (!prevSegment) {
      this.y = 0;
      this.currentWidth = seededRandom(seedBase) * maxWidth * 0.3 + maxWidth * 0.2;
    } else {
      this.y = prevSegment.y + prevSegment.height;
      this.currentWidth = prevSegment.endWidth;
    }

    let horizontalLen: number;
    let moveInward: boolean;
    let isPreLedge = false;

    const shouldCreateLedge =
      !!prevSegment && prevSegment.horizontalLen <= ledgeThreshold;

    if (shouldCreateLedge) {
      horizontalLen = ledgeWidth;
      moveInward = true;
      this.isLedge = true;
    } else {
      const minH = 20;
      const maxH = 60;
      horizontalLen = seededRandom(seedBase + 100) * (maxH - minH) + minH;

      if (horizontalLen <= ledgeThreshold) {
        isPreLedge = true;
        moveInward = true;
      } else {
        if (this.currentWidth + horizontalLen > maxWidth) {
          moveInward = false;
          const minWidth = Math.max(maxWidth * 0.1, 1);
          horizontalLen = Math.max(
            1,
            Math.min(horizontalLen, this.currentWidth - minWidth)
          );
        } else if (this.currentWidth - horizontalLen < maxWidth * 0.1) {
          moveInward = true;
        } else {
          moveInward = seededRandom(seedBase + 200) > 0.5;
        }
      }

      this.isLedge = false;
    }

    this.horizontalLen = Math.max(1, horizontalLen);
    this.moveInward = moveInward;
    this.isPreLedge = isPreLedge;

    let widthAfterHorizontal: number;
    if (moveInward) {
      widthAfterHorizontal = Math.min(
        maxWidth,
        this.currentWidth + this.horizontalLen
      );
    } else {
      widthAfterHorizontal = Math.max(
        maxWidth * 0.1,
        this.currentWidth - this.horizontalLen
      );
    }

    const minV = 180;
    const maxV = 300;
    this.verticalLen = seededRandom(seedBase + 300) * (maxV - minV) + minV;

    if (isPreLedge) {
      const outwardDistance = canvasWidth * 0.15;
      const maxOutward = widthAfterHorizontal - canvasWidth * 0.05;
      const actualOutward = Math.min(outwardDistance, maxOutward);
      this.angle = -Math.atan(actualOutward / this.verticalLen);
      this.endWidth = widthAfterHorizontal - actualOutward;
    } else {
      const angleRange = 0.1;
      this.angle = (seededRandom(seedBase + 400) - 0.5) * angleRange;
      const diagDisplacement = Math.tan(this.angle) * this.verticalLen;
      if (this.angle > 0) {
        this.endWidth = Math.min(maxWidth, widthAfterHorizontal + diagDisplacement);
      } else {
        this.endWidth = Math.max(maxWidth * 0.05, widthAfterHorizontal + diagDisplacement);
      }
    }

    this.height = this.verticalLen;
  }

  private computeGeometry(): {
    horizStartX: number;
    horizEndX: number;
    diagEndX: number;
    anchor: Edge;
  } {
    let horizStartX: number;
    let horizEndX: number;
    let diagEndX: number;

    if (this.side === 'left') {
      horizStartX = this.currentWidth;
      horizEndX = this.moveInward
        ? Math.min(this.currentWidth + this.horizontalLen, this.canvasWidth * MAX_WIDTH_RATIO)
        : Math.max(this.currentWidth - this.horizontalLen, 10);
      diagEndX = Math.min(this.endWidth, this.canvasWidth * MAX_WIDTH_RATIO);
    } else {
      horizStartX = this.canvasWidth - this.currentWidth;
      horizEndX = this.moveInward
        ? Math.max(
            this.canvasWidth - this.currentWidth - this.horizontalLen,
            this.canvasWidth * (1 - MAX_WIDTH_RATIO)
          )
        : Math.min(
            this.canvasWidth - this.currentWidth + this.horizontalLen,
            this.canvasWidth - 10
          );
      diagEndX = Math.max(this.canvasWidth - this.endWidth, this.canvasWidth * (1 - MAX_WIDTH_RATIO));
    }

    const anchor: Edge = this.side === 'left' ? 'right' : 'left';

    return { horizStartX, horizEndX, diagEndX, anchor };
  }

  private computeControlPoint(horizEndX: number, diagEndX: number): void {
    if (!this.hasArc) {
      this.controlX = null;
      this.controlY = null;
      return;
    }

    const arcDirection = this.side === 'left' ? 1 : -1;
    const startX = horizEndX;
    const startY = this.y;
    const endX = diagEndX;
    const endY = this.y + this.verticalLen;
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const angle = Math.atan2(endY - startY, endX - startX);
    const perpAngle = angle + Math.PI / 2;

    this.controlX = midX + Math.cos(perpAngle) * this.arcAmount * arcDirection;
    this.controlY = midY + Math.sin(perpAngle) * this.arcAmount * arcDirection;
  }

  getLedgeBounds(): { left: number; right: number; y: number } {
    const { horizStartX, horizEndX } = this.computeGeometry();
    const left = Math.min(horizStartX, horizEndX);
    const right = Math.max(horizStartX, horizEndX);
    const y = cliffState.origin + this.y;
    return { left, right, y };
  }

  getInteriorEdgeAt(y: number): number | null {
    const segmentTop = cliffState.origin + this.y;
    const segmentBottom = segmentTop + this.verticalLen;
    if (y < segmentTop || y > segmentBottom) return null;

    const { horizStartX, horizEndX, diagEndX } = this.computeGeometry();
    const startEdge = this.side === 'left'
      ? Math.max(horizStartX, horizEndX)
      : Math.min(horizStartX, horizEndX);
    const endEdge = this.side === 'left'
      ? Math.max(diagEndX, horizEndX)
      : Math.min(diagEndX, horizEndX);

    const t = this.verticalLen > 0 ? (y - segmentTop) / this.verticalLen : 0;
    const clamped = Math.min(Math.max(t, 0), 1);
    return startEdge + (endEdge - startEdge) * clamped;
  }

  draw(ctx: CanvasRenderingContext2D, canvasWidth: number, scrollY: number): void {
    const screenY = this.y - scrollY;

    const inwardLimitLeft = canvasWidth * MAX_WIDTH_RATIO;
    const inwardLimitRight = canvasWidth * (1 - MAX_WIDTH_RATIO);

    let horizStartX: number;
    let horizEndX: number;
    let diagEndX: number;

    if (this.side === 'left') {
      horizStartX = this.currentWidth;
      horizEndX = this.moveInward
        ? Math.min(this.currentWidth + this.horizontalLen, inwardLimitLeft)
        : Math.max(this.currentWidth - this.horizontalLen, 10);
      diagEndX = Math.min(this.endWidth, inwardLimitLeft);
    } else {
      horizStartX = canvasWidth - this.currentWidth;
      horizEndX = this.moveInward
        ? Math.max(
            canvasWidth - this.currentWidth - this.horizontalLen,
            inwardLimitRight
          )
        : Math.min(
            canvasWidth - this.currentWidth + this.horizontalLen,
            canvasWidth - 10
          );
      diagEndX = Math.max(canvasWidth - this.endWidth, inwardLimitRight);
    }

    this.drawInteriorTexture(
      ctx,
      canvasWidth,
      screenY,
      horizStartX,
      horizEndX,
      diagEndX
    );

    if (!this.horizontalCache) {
      this.horizontalCache = this.buildHorizontalCache(
        horizStartX,
        screenY,
        horizEndX,
        this.seedBase
      );
    }
    this.renderHorizontalCache(ctx, this.horizontalCache, horizStartX, screenY, horizEndX);

    const verticalAnchor: Edge = this.side === 'left' ? 'right' : 'left';
    if (!this.verticalCache) {
      this.verticalCache = this.buildVerticalCache(
        horizEndX,
        screenY,
        diagEndX,
        screenY + this.verticalLen,
        this.seedBase + 1000,
        verticalAnchor
      );
    }
    this.renderVerticalCache(
      ctx,
      this.verticalCache,
      horizEndX,
      screenY,
      diagEndX,
      screenY + this.verticalLen
    );
  }

  private drawInteriorTexture(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    screenY: number,
    horizStartX: number,
    horizEndX: number,
    diagEndX: number
  ): void {
    ctx.fillStyle = '#6ba1d7';
    const textureCount = Math.floor(this.height * 0.15);
    const padding = 12;
    const arcDirection = this.side === 'left' ? 1 : -1;

    this.controlX = null;
    this.controlY = null;
    let topX = horizEndX;
    const bottomX = diagEndX;
    const bottomY = screenY + this.verticalLen;

    if (this.hasArc) {
      const midX = (topX + bottomX) / 2;
      const midY = (screenY + bottomY) / 2;
      const angle = Math.atan2(bottomY - screenY, bottomX - topX);
      const perpAngle = angle + Math.PI / 2;
      this.controlX = midX + Math.cos(perpAngle) * this.arcAmount * arcDirection;
      this.controlY = midY + Math.sin(perpAngle) * this.arcAmount * arcDirection;
    }

    for (let i = 0; i < textureCount; i += 1) {
      const t = seededRandom(this.seedBase + 5000 + i * 47);
      const y = screenY + t * this.height;

      let minX: number;
      let maxX: number;

      if (y < screenY + 5) {
        if (this.side === 'left') {
          minX = padding;
          maxX = horizEndX - padding;
        } else {
          minX = horizEndX + padding;
          maxX = canvasWidth - padding;
        }
      } else {
        const diagT = (y - screenY) / this.verticalLen;
        let edgeX: number;
        if (this.hasArc && this.controlX !== null && this.controlY !== null) {
          const oneMinusT = 1 - diagT;
          edgeX =
            oneMinusT * oneMinusT * topX +
            2 * oneMinusT * diagT * this.controlX +
            diagT * diagT * bottomX;
        } else {
          edgeX = topX + (bottomX - topX) * diagT;
        }

        if (this.side === 'left') {
          minX = padding;
          maxX = edgeX - padding;
        } else {
          minX = edgeX + padding;
          maxX = canvasWidth - padding;
        }
      }

      if (!Number.isFinite(minX) || !Number.isFinite(maxX)) continue;
      if (maxX <= minX) continue;

      const randomSeed = this.seedBase + 6000 + i * 53;
      const x = minX + seededRandom(randomSeed) * (maxX - minX);
      const type = seededRandom(this.seedBase + 7000 + i * 61);

      const drawX = Math.round(x);
      const drawY = Math.round(y);

      if (type < 0.6) {
        ctx.fillRect(drawX, drawY, 3, 3);
      } else {
        const dashLen =
          8 + seededRandom(this.seedBase + 8000 + i * 67) * 16;
        ctx.fillRect(drawX, drawY, Math.round(dashLen), 3);
      }
    }
  }

  private buildHorizontalCache(
    x1: number,
    y1: number,
    x2: number,
    seed: number
  ): HorizontalCacheEntry[] {
    const start = Math.min(x1, x2);
    const baseY = Math.round(y1);
    let x = start;
    const end = Math.max(x1, x2);
    let shapeIndex = 0;

    const entries: HorizontalCacheEntry[] = [];
    while (x < end) {
      let cells = generatePolyomino(seed + shapeIndex * 123, 4, 9);
      cells = flattenEdge(cells, 'top');
      const bounds = getBounds(cells);
      const shapeWidth = bounds.w * CELL_SIZE;

      const offsets: PolyominoOffsets = Array.from(cells, (key) => {
        const [cx, cy] = key.split(',').map(Number);
        return [cx, cy] as const;
      });

      entries.push({
        offsetX: Math.round(x - start),
        offsetY: Math.round(y1) - baseY,
        cells: offsets
      });

      x += Math.max(1, shapeWidth - 1);
      shapeIndex += 1;
    }

    return entries;
  }

  private buildVerticalCache(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    seed: number,
    anchor: Edge
  ): VerticalCacheEntry[] {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / (CELL_SIZE * 6)));

    const shouldArc = this.hasArc;
    const arcAmount = this.arcAmount;
    const arcDirection = this.side === 'left' ? 1 : -1;

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const perpAngle = angle + Math.PI / 2;
    const controlX = shouldArc
      ? midX + Math.cos(perpAngle) * arcAmount * arcDirection
      : 0;
    const controlY = shouldArc
      ? midY + Math.sin(perpAngle) * arcAmount * arcDirection
      : 0;

    const entries: VerticalCacheEntry[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;

      let x: number;
      let y: number;

      if (shouldArc) {
        const oneMinusT = 1 - t;
        x =
          oneMinusT * oneMinusT * x1 +
          2 * oneMinusT * t * controlX +
          t * t * x2;
        y =
          oneMinusT * oneMinusT * y1 +
          2 * oneMinusT * t * controlY +
          t * t * y2;
      } else {
        x = x1 + (x2 - x1) * t;
        y = y1 + (y2 - y1) * t;
      }

      let cells = generatePolyomino(seed + i * 79, 4, 9);
      cells = flattenEdge(cells, anchor);
      const bounds = getBounds(cells);

      const offsets: PolyominoOffsets = Array.from(cells, (key) => {
        const [cx, cy] = key.split(',').map(Number);
        return [cx, cy] as const;
      });

      entries.push({
        t,
        anchor,
        widthPixels: bounds.w * CELL_SIZE,
        cells: offsets
      });
    }

    return entries;
  }

  private renderHorizontalCache(
    ctx: CanvasRenderingContext2D,
    cache: HorizontalCacheEntry[] | null,
    x1: number,
    y1: number,
    x2: number
  ): void {
    if (USE_OFFSCREEN_CANVAS) {
      // TODO: draw cliffs into an offscreen canvas and blit them to improve fillRect throughput.
    }
    if (!cache) return;
    const start = Math.round(Math.min(x1, x2));
    const baseY = Math.round(y1);

    ctx.fillStyle = '#FFFFFF';
    for (const entry of cache) {
      const px = start + entry.offsetX;
      const py = baseY + entry.offsetY;
      for (const [cx, cy] of entry.cells) {
        ctx.fillRect(
          px + cx * CELL_SIZE,
          py + cy * CELL_SIZE,
          CELL_SIZE,
          CELL_SIZE
        );
      }
    }
  }

  private renderVerticalCache(
    ctx: CanvasRenderingContext2D,
    cache: VerticalCacheEntry[] | null,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): void {
    if (!cache) return;

    const shouldArc = this.hasArc;
    const controlX = this.controlX;
    const controlY = this.controlY;

    ctx.fillStyle = '#FFFFFF';
    for (const entry of cache) {
      const t = entry.t;
      let x: number;
      let y: number;

      if (shouldArc && controlX !== null && controlY !== null) {
        const oneMinusT = 1 - t;
        x =
          oneMinusT * oneMinusT * x1 +
          2 * oneMinusT * t * controlX +
          t * t * x2;
        y =
          oneMinusT * oneMinusT * y1 +
          2 * oneMinusT * t * controlY +
          t * t * y2;
      } else {
        x = x1 + (x2 - x1) * t;
        y = y1 + (y2 - y1) * t;
      }

      const px =
        entry.anchor === 'right'
          ? Math.round(x) - entry.widthPixels
          : Math.round(x);
      const py = Math.round(y);

      for (const [cx, cy] of entry.cells) {
        ctx.fillRect(
          px + cx * CELL_SIZE,
          py + cy * CELL_SIZE,
          CELL_SIZE,
          CELL_SIZE
        );
      }
    }
  }
}

export function prepareCliffField(
  canvasWidth: number,
  cliffTopWorld: number,
  targetBottomWorld: number
): void {
  if (!Number.isFinite(canvasWidth) || canvasWidth <= 0) return;
  if (!Number.isFinite(cliffTopWorld) || !Number.isFinite(targetBottomWorld)) return;

  const requiredHeight = Math.max(0, targetBottomWorld - cliffTopWorld);
  if (requiredHeight <= 0) return;

  if (
    !cliffState.initialized ||
    cliffState.canvasWidth !== canvasWidth ||
    Math.abs(cliffState.origin - cliffTopWorld) > 0.5
  ) {
    initializeCliffs(cliffTopWorld, canvasWidth, requiredHeight);
  } else if (requiredHeight > cliffState.cavernHeight) {
    cliffState.cavernHeight = requiredHeight;
  }

  const targetDepth = Math.max(0, targetBottomWorld - cliffState.origin) + SEGMENT_HEIGHT * BUFFER_SEGMENTS;
  ensureSegments(targetDepth);
}

export function getCliffInteriorBoundsAtY(y: number): { left: number; right: number } {
  if (!cliffState.initialized || !Number.isFinite(y)) {
    return { left: 0, right: Infinity };
  }

  let leftBoundary = 0;
  let rightBoundary = cliffState.canvasWidth > 0 ? cliffState.canvasWidth : Infinity;

  for (const segment of cliffState.leftSegments) {
    const edge = segment.getInteriorEdgeAt(y);
    if (edge === null) continue;
    leftBoundary = Math.max(leftBoundary, edge + CLIFF_CLEARANCE);
  }

  for (const segment of cliffState.rightSegments) {
    const edge = segment.getInteriorEdgeAt(y);
    if (edge === null) continue;
    rightBoundary = Math.min(rightBoundary, edge - CLIFF_CLEARANCE);
  }

  if (leftBoundary > rightBoundary) {
    const midpoint = (leftBoundary + rightBoundary) / 2;
    leftBoundary = midpoint - CELL_SIZE;
    rightBoundary = midpoint + CELL_SIZE;
  }

  return { left: leftBoundary, right: rightBoundary };
}

export function getCliffLedgesInRange(rangeTop: number, rangeBottom: number): CliffLedge[] {
  const ledges: CliffLedge[] = [];
  if (!cliffState.initialized) return ledges;
  if (!Number.isFinite(rangeTop) || !Number.isFinite(rangeBottom)) return ledges;

  for (const segment of cliffState.leftSegments) {
    const { left, right, y } = segment.getLedgeBounds();
    if (y < rangeTop - CLIFF_LEDGE_TOLERANCE || y > rangeBottom + CLIFF_LEDGE_TOLERANCE) continue;
    ledges.push({ left, right, y });
  }

  for (const segment of cliffState.rightSegments) {
    const { left, right, y } = segment.getLedgeBounds();
    if (y < rangeTop - CLIFF_LEDGE_TOLERANCE || y > rangeBottom + CLIFF_LEDGE_TOLERANCE) continue;
    ledges.push({ left, right, y });
  }

  return ledges;
}

interface CliffRenderState {
  initialized: boolean;
  origin: number;
  canvasWidth: number;
  cavernHeight: number;
  leftSegments: CliffSegment[];
  rightSegments: CliffSegment[];
}

const cliffState: CliffRenderState = {
  initialized: false,
  origin: 0,
  canvasWidth: 0,
  cavernHeight: 0,
  leftSegments: [],
  rightSegments: []
};

export function resetCliffs(): void {
  cliffState.initialized = false;
  cliffState.origin = 0;
  cliffState.canvasWidth = 0;
  cliffState.cavernHeight = 0;
  cliffState.leftSegments = [];
  cliffState.rightSegments = [];
}

function initializeCliffs(origin: number, canvasWidth: number, cavernHeight: number): void {
  cliffState.initialized = true;
  cliffState.origin = origin;
  cliffState.canvasWidth = canvasWidth;
  cliffState.cavernHeight = cavernHeight;
  cliffState.leftSegments = [];
  cliffState.rightSegments = [];

  const numSegments = Math.max(1, Math.ceil(cavernHeight / SEGMENT_HEIGHT) + BUFFER_SEGMENTS);
  for (let i = 0; i < numSegments; i += 1) {
    const prevLeft = cliffState.leftSegments[cliffState.leftSegments.length - 1] ?? null;
    cliffState.leftSegments.push(new CliffSegment('left', prevLeft, canvasWidth, i * 7919));

    const prevRight = cliffState.rightSegments[cliffState.rightSegments.length - 1] ?? null;
    cliffState.rightSegments.push(
      new CliffSegment('right', prevRight, canvasWidth, i * 7919 + 3571)
    );
  }
}

function ensureSegments(targetDepth: number): void {
  const lists: Array<{ segments: CliffSegment[]; offset: number; side: CliffSide }> = [
    { segments: cliffState.leftSegments, offset: 0, side: 'left' },
    { segments: cliffState.rightSegments, offset: 3571, side: 'right' }
  ];

  for (const list of lists) {
    let lastBottom = 0;
    const last = list.segments[list.segments.length - 1];
    if (last) lastBottom = last.y + last.height;

    while (lastBottom < targetDepth) {
      const index = list.segments.length;
      const prev = list.segments[index - 1] ?? null;
      const seedBase = index * 7919 + list.offset;
      const segment = new CliffSegment(list.side, prev, cliffState.canvasWidth, seedBase);
      list.segments.push(segment);
      lastBottom = segment.y + segment.height;
    }
  }
}

export interface CliffRenderOptions {
  canvasWidth: number;
  canvasHeight: number;
  cameraY: number;
  cavernTop: number;
  cavernBottom: number;
}

export function drawCavernCliffs(
  ctx: CanvasRenderingContext2D,
  options: CliffRenderOptions
): void {
  const { canvasWidth, canvasHeight, cameraY, cavernTop, cavernBottom } = options;

  if (!Number.isFinite(canvasWidth) || canvasWidth <= 0) return;
  if (!Number.isFinite(cavernTop) || !Number.isFinite(cavernBottom)) return;

  const cavernHeight = Math.max(0, cavernBottom - cavernTop);
  if (cavernHeight <= 0) return;

  if (
    !cliffState.initialized ||
    cliffState.canvasWidth !== canvasWidth ||
    Math.abs(cliffState.origin - cavernTop) > 0.5
  ) {
    initializeCliffs(cavernTop, canvasWidth, cavernHeight);
  } else if (cavernHeight > cliffState.cavernHeight) {
    cliffState.cavernHeight = cavernHeight;
  }

  const viewBottom = cameraY + canvasHeight;
  const depthFromOrigin = Math.max(
    cavernHeight,
    viewBottom - cliffState.origin + SEGMENT_HEIGHT * BUFFER_SEGMENTS
  );
  ensureSegments(depthFromOrigin);

  const clipTop = cavernTop - cameraY;
  const clipHeight = cavernBottom - cavernTop;
  if (!Number.isFinite(clipTop) || clipHeight <= 0) return;

  const previousSmoothing = ctx.imageSmoothingEnabled;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath();
  ctx.rect(0, clipTop, canvasWidth, clipHeight);
  ctx.clip();

  const scrollY = cameraY - cliffState.origin;
  const viewTop = cameraY - clipHeight;
  const extendedViewBottom = viewBottom + SEGMENT_HEIGHT;

  const drawSegments = (segments: CliffSegment[]) => {
    for (const segment of segments) {
      const segmentTop = cliffState.origin + segment.y;
      const segmentBottom = segmentTop + segment.height;
      if (segmentBottom < cavernTop || segmentTop > cavernBottom) continue;
      if (segmentBottom < viewTop || segmentTop > extendedViewBottom) continue;
      segment.draw(ctx, canvasWidth, scrollY);
    }
  };

  drawSegments(cliffState.leftSegments);
  drawSegments(cliffState.rightSegments);

  ctx.restore();
  ctx.imageSmoothingEnabled = previousSmoothing;
}
