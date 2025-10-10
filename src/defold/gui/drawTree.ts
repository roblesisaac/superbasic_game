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

interface FoliagePoint {
  x: number;
  y: number;
  weight: number;
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

const DEFAULT_TREE = {
  size: 74,
  foliageDensity: 0.72,
  bushiness: 1.15,
  seed: 0x0f0f,
  color: '#fff'
} as const;

const treeSpriteCache = new Map<string, TreeSprite>();

function createRandom(sequenceSeed: number): () => number {
  let seed = sequenceSeed;
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function drawPixel(ctx: TreeDrawContext, px: number, py: number): void {
  const ix = Math.round(px);
  const iy = Math.round(py);
  const canvasWidth = ctx.canvas?.width ?? 0;
  const canvasHeight = ctx.canvas?.height ?? 0;

  if (ix < 0 || iy < 0) return;
  if (ix >= canvasWidth || iy >= canvasHeight) return;
  ctx.fillRect(ix, iy, 1, 1);
}

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
  const paddingX = 16;
  const paddingTop = 24;
  const paddingBottom = 16;

  const width = canopyRadiusX * 2 + paddingX * 2;
  const height = paddingTop + trunkHeight + canopyOverhang + canopyRadiusY + canopyExtraBelow + paddingBottom;
  const centerX = Math.round(width / 2);
  const baseY = height - paddingBottom;

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
  const { size, foliageDensity, bushiness, seed, color } = config;
  const { centerX, baseY, trunkHeight, trunkWidth } = metrics;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = color;

  const random = createRandom(Math.floor(seed));
  const foliagePoints: FoliagePoint[] = [];

  for (let y = 0; y < trunkHeight; y += 1) {
    const wobble = Math.sin(y * 0.08) * 1;
    const taper = 1 - (y / trunkHeight) * 0.3;
    const width = Math.max(1, Math.floor(trunkWidth * taper));
    const halfWidth = Math.floor(width / 2);

    for (let offset = -halfWidth; offset <= halfWidth; offset += 1) {
      drawPixel(ctx, centerX + offset + wobble, baseY - y);
    }
  }

  function drawBranch(
    startX: number,
    startY: number,
    length: number,
    angle: number,
    thickness: number,
    depth: number
  ): void {
    if (depth <= 0 || length < 3) {
      foliagePoints.push({ x: startX, y: startY, weight: length });
      return;
    }

    const endX = startX + Math.cos(angle) * length;
    const endY = startY - Math.sin(angle) * length;
    const steps = Math.max(1, Math.ceil(length));

    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const branchX = startX + (endX - startX) * t;
      const branchY = startY + (endY - startY) * t;
      const baseX = Math.round(branchX);
      const baseYLocal = Math.round(branchY);

      for (let w = 0; w < thickness; w += 1) {
        drawPixel(ctx, baseX - Math.floor(thickness / 2) + w, baseYLocal);
      }
    }

    const newLength = length * (0.55 + random() * 0.15);
    const newThickness = Math.max(1, thickness - 1);
    const spread = 0.4 + random() * 0.3;

    drawBranch(endX, endY, newLength, angle + spread, newThickness, depth - 1);
    drawBranch(endX, endY, newLength, angle - spread, newThickness, depth - 1);

    if (random() < 0.4 && depth > 2) {
      drawBranch(endX, endY, newLength * 0.8, angle + (random() - 0.5) * 0.3, newThickness, depth - 1);
    }
  }

  const startY = baseY - trunkHeight;
  const mainBranchLength = size * 0.6;

  drawBranch(centerX, startY, mainBranchLength, Math.PI / 2, 3, 5);
  drawBranch(centerX, startY - 5, mainBranchLength * 0.9, Math.PI / 2 + 0.5, 3, 5);
  drawBranch(centerX, startY - 5, mainBranchLength * 0.9, Math.PI / 2 - 0.5, 3, 5);
  drawBranch(centerX, startY - 10, mainBranchLength * 0.8, Math.PI / 2 + 0.8, 2, 4);
  drawBranch(centerX, startY - 10, mainBranchLength * 0.8, Math.PI / 2 - 0.8, 2, 4);

  const clusterBaseSize = Math.max(4, size * 0.25 * bushiness);
  const clusterDrawCount = Math.max(0, Math.floor(clusterBaseSize * clusterBaseSize * 0.3));

  foliagePoints.forEach((point) => {
    const clusterSize = clusterBaseSize * (0.8 + random() * 0.4);
    for (let i = 0; i < clusterDrawCount; i += 1) {
      const angle = random() * Math.PI * 2;
      const distance = random() * random() * clusterSize;
      const fx = point.x + Math.cos(angle) * distance;
      const fy = point.y + Math.sin(angle) * distance * 0.9;

      if (random() >= foliageDensity) continue;
      drawPixel(ctx, fx, fy);

      if (random() < 0.4) drawPixel(ctx, fx + 1, fy);
      if (random() < 0.3) drawPixel(ctx, fx, fy + 1);
      if (random() < 0.2) drawPixel(ctx, fx + 1, fy + 1);
    }
  });

  const canopyY = startY - size * 0.35;
  const canopyRadiusX = metrics.canopyRadiusX;
  const canopyRadiusY = metrics.canopyRadiusY;

  for (let y = -canopyRadiusY; y < canopyRadiusY * 0.3; y += 1) {
    for (let xOffset = -canopyRadiusX; xOffset < canopyRadiusX; xOffset += 1) {
      const normalizedX = xOffset / canopyRadiusX;
      const normalizedY = y / canopyRadiusY;
      const distance = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
      const edgeNoise = Math.sin(xOffset * 0.15) * 0.15 + Math.cos(y * 0.12) * 0.15;
      const threshold = 0.85 + edgeNoise;

      if (distance >= threshold) continue;
      if (random() >= foliageDensity * 0.6) continue;

      drawPixel(ctx, centerX + xOffset, canopyY + y);
    }
  }
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
