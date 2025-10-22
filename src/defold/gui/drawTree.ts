interface TreeOptions {
  x: number;
  groundY: number;
  cameraY: number;
  size?: number;
  foliageDensity?: number;
  bushiness?: number;
  seed?: number;
  color?: string;
}

type TreeDrawContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface NormalizedTreeOptions {
  size: number;
  foliageDensity: number;
  bushiness: number;
  seed: number;
  color: string;
}

interface TreeMetrics {
  width: number;
  height: number;
  centerX: number;
  baseY: number;
  trunkHeight: number;
  trunkWidth: number;
  canopyRadiusX: number;
  canopyRadiusY: number;
}

interface TreeSprite {
  canvas: CanvasImageSource;
  metrics: TreeMetrics;
}

const TREE_PADDING_X = 16;
const TREE_PADDING_TOP = 24;
const TREE_PADDING_BOTTOM = 4;

const FOLIAGE_PATTERN = [
  '                  1111              ',
  '           11111111111111           ',
  '         11111111111111111  1       ',
  '         1111111111111111111111     ',
  '     111   111111111111111111111    ',
  '   11111111111111111111111111111    ',
  '     11111111111111111111111111     ',
  ' 1111111111111111111111111111111111 ',
  '11111111111111111111111111111111111 ',
  '111111111111111111111111111111111111',
  '111111111111111111111111111111111111',
  '  1111111  111111111111111111111111 ',
  ' 1111111    1111     11111  1111    ',
  ' 111111111           1111    111111 ',
  '    11111                   111111  ',
  '                            1111    '
] as const;

const TRUNK_PATTERN = [
  '       111                          ',
  '        111                         ',
  '          11111         11          ',
  '            111111    111           ',
  '              11111111              ',
  '              11111111              ',
  '              11111111              ',
  '              11111111              ',
  '         111111     1111111         ',
  '      111111           1111111      '
] as const;

const TREE_TRUNK_OVERLAP_ROWS = 2;
const FOLIAGE_BASE_PIXEL_WIDTH = 10;
const TRUNK_BASE_PIXEL_WIDTH = 5;
const TREE_PATTERN_MAX_WIDTH = Math.max(
  ...FOLIAGE_PATTERN.map((row) => row.length),
  ...TRUNK_PATTERN.map((row) => row.length)
);
const TREE_PATTERN_TOTAL_ROWS = FOLIAGE_PATTERN.length + TRUNK_PATTERN.length - TREE_TRUNK_OVERLAP_ROWS;

const DEFAULT_TREE = {
  size: 74,
  foliageDensity: .72,
  bushiness: 1.15,
  seed: 0x0f0f,
  color: '#2e2e2e'
} as const;

const treeSpriteCache = new Map<string, TreeSprite>();

function normalizeTreeOptions(options: TreeOptions): NormalizedTreeOptions {
  const { size, foliageDensity, bushiness, seed, color } = options;
  const normalizedSize =
    typeof size === 'number' && Number.isFinite(size) && size > 0 ? size : DEFAULT_TREE.size;
  const normalizedFoliageDensity =
    typeof foliageDensity === 'number' && Number.isFinite(foliageDensity)
      ? foliageDensity
      : DEFAULT_TREE.foliageDensity;
  const normalizedBushiness =
    typeof bushiness === 'number' && Number.isFinite(bushiness) ? bushiness : DEFAULT_TREE.bushiness;
  const normalizedSeed = typeof seed === 'number' && Number.isFinite(seed) ? seed : DEFAULT_TREE.seed;
  const normalizedColor = typeof color === 'string' ? color : DEFAULT_TREE.color;

  return {
    size: normalizedSize,
    foliageDensity: normalizedFoliageDensity,
    bushiness: normalizedBushiness,
    seed: normalizedSeed,
    color: normalizedColor
  };
}

function makeCacheKey(config: NormalizedTreeOptions): string {
  return [
    `s:${config.size.toFixed(2)}`,
    `f:${config.foliageDensity.toFixed(3)}`,
    `b:${config.bushiness.toFixed(3)}`,
    `seed:${Math.floor(config.seed)}`,
    `c:${config.color}`
  ].join('|');
}

function computeTreeMetrics(config: NormalizedTreeOptions): TreeMetrics {
  const trunkHeight = Math.max(12, Math.round(config.size * 0.5));
  const trunkWidth = Math.max(4, Math.floor(config.size / 12));
  const canopyRadiusX = Math.max(8, Math.round(config.size * config.bushiness));
  const canopyRadiusY = Math.max(6, Math.round(config.size * 0.7));
  const canopyOverhang = Math.round(config.size * 0.35);
  const canopyExtraBelow = Math.ceil(canopyRadiusY * 0.3);

  const width = canopyRadiusX * 2 + TREE_PADDING_X * 2;
  const height =
    TREE_PADDING_TOP + trunkHeight + canopyOverhang + canopyRadiusY + canopyExtraBelow + TREE_PADDING_BOTTOM;
  const centerX = Math.round(width / 2);
  const baseY = height - TREE_PADDING_BOTTOM;

  return {
    width,
    height,
    centerX,
    baseY,
    trunkHeight,
    trunkWidth,
    canopyRadiusX,
    canopyRadiusY
  };
}

function createTreeSprite(config: NormalizedTreeOptions, metrics: TreeMetrics): TreeSprite | null {
  let canvas: HTMLCanvasElement | OffscreenCanvas | null = null;

  if (typeof OffscreenCanvas === 'function') {
    canvas = new OffscreenCanvas(metrics.width, metrics.height);
  } else if (typeof document !== 'undefined') {
    const element = document.createElement('canvas');
    element.width = metrics.width;
    element.height = metrics.height;
    canvas = element;
  }

  if (!canvas) return null;

  const context = canvas.getContext('2d', { alpha: true }) as TreeDrawContext | null;
  if (!context) return null;

  renderTreeSprite(context, config, metrics);
  return { canvas, metrics };
}

function getTreeSprite(config: NormalizedTreeOptions): TreeSprite | null {
  const key = makeCacheKey(config);
  const cached = treeSpriteCache.get(key);
  if (cached) return cached;

  const metrics = computeTreeMetrics(config);
  const sprite = createTreeSprite(config, metrics);
  if (!sprite) return null;
  treeSpriteCache.set(key, sprite);
  return sprite;
}

function renderTreeSprite(ctx: TreeDrawContext, config: NormalizedTreeOptions, metrics: TreeMetrics): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = config.color;
  ctx.imageSmoothingEnabled = false;

  if (TREE_PATTERN_MAX_WIDTH <= 0 || TREE_PATTERN_TOTAL_ROWS <= 0) return;

  const availableWidth = metrics.width - TREE_PADDING_X * 2;
  const availableHeight = metrics.baseY - TREE_PADDING_TOP;
  if (availableWidth <= 0 || availableHeight <= 0) return;

  const foliageCellWidth = availableWidth / TREE_PATTERN_MAX_WIDTH;
  const trunkCellWidth = foliageCellWidth * (TRUNK_BASE_PIXEL_WIDTH / FOLIAGE_BASE_PIXEL_WIDTH);
  const cellHeight = availableHeight / TREE_PATTERN_TOTAL_ROWS;
  const trunkStartRowIndex = FOLIAGE_PATTERN.length - TREE_TRUNK_OVERLAP_ROWS;
  const trunkShift = foliageCellWidth / FOLIAGE_BASE_PIXEL_WIDTH;

  const drawRow = (row: string, rowIndex: number, cellWidth: number, offsetX: number) => {
    if (row.length === 0) return;

    const rowWidth = row.length * cellWidth;
    const baseLeft = metrics.centerX - rowWidth / 2 + offsetX;
    const top = TREE_PADDING_TOP + rowIndex * cellHeight;

    for (let i = 0; i < row.length; i += 1) {
      if (row[i] !== '1') continue;

      const cellLeft = baseLeft + i * cellWidth;
      const xStart = Math.round(cellLeft);
      const xEnd = Math.round(cellLeft + cellWidth);
      const yStart = Math.round(top);
      const yEnd = Math.round(top + cellHeight);
      const width = Math.max(1, xEnd - xStart);
      const height = Math.max(1, yEnd - yStart);

      ctx.fillRect(xStart, yStart, width, height);
    }
  };

  FOLIAGE_PATTERN.forEach((row, index) => {
    drawRow(row, index, foliageCellWidth, 0);
  });

  TRUNK_PATTERN.forEach((row, index) => {
    const patternRowIndex = trunkStartRowIndex + index;
    drawRow(row, patternRowIndex, trunkCellWidth, trunkShift);
  });
}

export function drawTree(
  ctx: CanvasRenderingContext2D,
  options: TreeOptions
): void {
  if (!Number.isFinite(options.x)) return;
  const {
    x,
    groundY,
    cameraY
  } = options;

  const config = normalizeTreeOptions(options);
  const sprite = getTreeSprite(config);
  if (!sprite) return;

  const canvasHeight = ctx.canvas?.height ?? 0;
  const screenGroundY = Math.round(groundY - cameraY);

  const { metrics, canvas } = sprite;
  const { height, width } = metrics;

  if (screenGroundY < -height || screenGroundY > canvasHeight + height) return;

  const drawX = Math.round(x - width / 2);
  const drawY = Math.round(screenGroundY - height);
  ctx.drawImage(canvas, drawX, drawY);
}
