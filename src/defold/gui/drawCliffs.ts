type CliffSide = 'left' | 'right';

const CELL_SIZE = 4;
const MAX_WIDTH_RATIO = 0.3;
const LEDGE_THRESHOLD_RATIO = 0.1;
const LEDGE_WIDTH_RATIO = 0.3;
const SEGMENT_HEIGHT = 240;
const BUFFER_SEGMENTS = 4;

type PolyominoCellSet = Set<string>;

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generatePolyomino(seed: number, minSize = 4, maxSize = 9): PolyominoCellSet {
  const target = Math.floor(seededRandom(seed) * (maxSize - minSize + 1)) + minSize;
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
    const anchorSeed = seed + attempts;
    const dirSeed = seed + attempts + 1000;
    const [x, y] = arr[Math.floor(seededRandom(anchorSeed) * arr.length)]
      .split(',')
      .map(Number);
    const [dx, dy] = dirs[Math.floor(seededRandom(dirSeed) * dirs.length)];
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

  return {
    minX,
    minY,
    maxX,
    maxY,
    w: maxX - minX + 1,
    h: maxY - minY + 1
  };
}

function flattenEdge(cells: PolyominoCellSet, side: 'left' | 'right' | 'top' | 'bottom'): PolyominoCellSet {
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
  seedBase: number;

  constructor(
    side: CliffSide,
    prevSegment: CliffSegment | null,
    canvasWidth: number,
    seedBase: number
  ) {
    this.side = side;
    this.seedBase = seedBase;

    const maxWidth = canvasWidth * MAX_WIDTH_RATIO;
    const ledgeThreshold = canvasWidth * LEDGE_THRESHOLD_RATIO;
    const ledgeWidth = canvasWidth * LEDGE_WIDTH_RATIO;

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

    const shouldCreateLedge = !!prevSegment && prevSegment.horizontalLen <= ledgeThreshold;

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
      widthAfterHorizontal = Math.min(maxWidth, this.currentWidth + this.horizontalLen);
    } else {
      widthAfterHorizontal = Math.max(maxWidth * 0.1, this.currentWidth - this.horizontalLen);
    }

    const minV = 180;
    const maxV = 300;
    this.verticalLen = seededRandom(seedBase + 300) * (maxV - minV) + minV;

    if (isPreLedge) {
      const outwardDistance = canvasWidth * 0.15;
      const maxOutward = widthAfterHorizontal - canvasWidth * 0.05;
      const actualOutward = Math.max(0, Math.min(outwardDistance, maxOutward));
      this.angle = -Math.atan(actualOutward / this.verticalLen);
      this.endWidth = Math.max(canvasWidth * 0.05, widthAfterHorizontal - actualOutward);
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

  draw(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    scrollY: number
  ): void {
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
        : Math.min(canvasWidth - this.currentWidth + this.horizontalLen, canvasWidth - 10);
      diagEndX = Math.max(canvasWidth - this.endWidth, inwardLimitRight);
    }

    this.drawInteriorTexture(ctx, canvasWidth, screenY, horizStartX, horizEndX, diagEndX);

    this.drawPolyominoLineHorizontal(horizStartX, screenY, horizEndX, screenY, this.seedBase, ctx);

    const anchor: 'left' | 'right' = this.side === 'left' ? 'right' : 'left';
    this.drawPolyominoLineVertical(
      horizEndX,
      screenY,
      diagEndX,
      screenY + this.verticalLen,
      this.seedBase + 1000,
      anchor,
      ctx
    );
  }

  private drawInteriorTexture(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    screenY: number,
    horizStartX: number,
    horizEndX: number,
    diagEndX: number
  ) {
    const textureCount = Math.floor(this.height * 0.15);
    const padding = 12;
    ctx.fillStyle = '#FFFFFF';

    for (let i = 0; i < textureCount; i += 1) {
      const t = seededRandom(this.seedBase + 5000 + i * 47);
      const y = screenY + t * this.height;

      let minX: number;
      let maxX: number;
      if (this.side === 'left') {
        if (y < screenY + 5) {
          maxX = horizEndX - padding;
        } else {
          const diagT = (y - screenY) / this.verticalLen;
          maxX =
            horizEndX + (diagEndX - horizEndX) * diagT - padding;
        }
        minX = padding;
      } else {
        if (y < screenY + 5) {
          minX = horizEndX + padding;
        } else {
          const diagT = (y - screenY) / this.verticalLen;
          minX =
            horizEndX + (diagEndX - horizEndX) * diagT + padding;
        }
        maxX = canvasWidth - padding;
      }

      if (!Number.isFinite(minX) || !Number.isFinite(maxX)) continue;
      if (maxX <= minX) continue;

      const x =
        minX +
        seededRandom(this.seedBase + 6000 + i * 53) * (maxX - minX);
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

  private drawPolyominoLineHorizontal(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    seed: number,
    ctx: CanvasRenderingContext2D
  ) {
    let x = Math.min(x1, x2);
    const end = Math.max(x1, x2);
    let shapeIndex = 0;

    ctx.fillStyle = '#FFFFFF';

    while (x < end) {
      let cells = generatePolyomino(seed + shapeIndex * 123, 4, 9);
      cells = flattenEdge(cells, 'top');
      const bounds = getBounds(cells);
      const shapeWidth = bounds.w * CELL_SIZE;

      const px = Math.round(x);
      const py = Math.round(y1);
      for (const key of cells) {
        const [cx, cy] = key.split(',').map(Number);
        ctx.fillRect(px + cx * CELL_SIZE, py + cy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }

      x += Math.max(1, shapeWidth - 1);
      shapeIndex += 1;
    }
  }

  private drawPolyominoLineVertical(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    seed: number,
    anchor: 'left' | 'right',
    ctx: CanvasRenderingContext2D
  ) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / (CELL_SIZE * 6)));

    ctx.fillStyle = '#FFFFFF';

    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;

      let cells = generatePolyomino(seed + i * 79, 4, 9);
      cells = flattenEdge(cells, anchor === 'right' ? 'right' : 'left');
      const bounds = getBounds(cells);

      let px: number;
      let py: number;
      if (anchor === 'right') {
        px = Math.round(x - bounds.w * CELL_SIZE);
        py = Math.round(y);
      } else {
        px = Math.round(x);
        py = Math.round(y);
      }

      for (const key of cells) {
        const [cx, cy] = key.split(',').map(Number);
        ctx.fillRect(px + cx * CELL_SIZE, py + cy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }
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
  const {
    canvasWidth,
    canvasHeight,
    cameraY,
    cavernTop,
    cavernBottom
  } = options;

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
