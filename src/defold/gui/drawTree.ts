// ─────────────────────────────────────────────────────────────
// Tree (single pattern, one-pass renderer, no unused options)
// ─────────────────────────────────────────────────────────────

interface TreeOptions {
  x: number;
  groundY: number;
  cameraY: number;
  size?: number;   // controls overall scale
  color?: string;  // fill color
}

type TreeDrawContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface NormalizedTreeOptions {
  size: number;
  color: string;
}

interface TreeMetrics {
  width: number;
  height: number;
  centerX: number;
  baseY: number;
}

interface TreeSprite {
  canvas: CanvasImageSource;
  metrics: TreeMetrics;
}

const TREE_PADDING_X = 16;
const TREE_PADDING_TOP = 24;
const TREE_PADDING_BOTTOM = 0;

/**
 * Build `tree1` from the attached TXT verbatim.
 * Rule: every non-space char becomes '1'; spaces remain spaces.
 */
const tree1: readonly string[] = (() => {
  const RAW = `
                                                                11111                                                           
                                                         1111  11111111111                                                     
                                                      11111111111111111111                                                     
                                                    111111111111111111111111  11                                               
                                                    111111111111111111111111111111                                             
                                               111  111111111111111111111111111111                                             
                                             11111    111111111111111111111111111111                                           
                                            1111111111111111111111111111111111111111                                           
                                           111111111111111111111111111111111111111                                             
                                             1111111111111111111111111111111111111                                             
                                        111  111111111111111111111111111111111111111111                                        
                                       1111111111111111111111111111111111111111111111111                                       
                                      11111111111111111111111111111111111111111111111111                                       
                                      111111111111111111111111111111111111111111111111111                                      
                                      1111111111111111111111111111111111111111111111111111                                     
                                       111111111111111111111111111111111111111111111111111                                     
                                         1111111111   111111111111111111111111111111111                                        
                                          11111111    1111111111   111111111111111111                                          
                                        1111111111      11111       1111111   111111                                           
                                        11111111111                 111111      1111111                                        
                                          11111111111    111                  111111111                                        
                                             1111111       1111       11     111111111                                         
                                                            11111    111    11111111                                           
                                                              111111111                                                        
                                                              1111111                                                          
                                                              1111111                                                          
                                                              1111111                                                          
                                                              1111111                                                          
                                                            11111111111                                                        
                                                          11111    111111                                                      
                                                       11111          111111                                                   
                                                                                                                      
  `.slice(1, -1); // drop indentation guard newlines only

  // Convert every non-space glyph into '1' while preserving all spacing + line lengths
  const toOnes = (line: string) => line.replace(/[^\s]/g, '1');
  return RAW.split('\n').map(toOnes) as readonly string[];
})();

const DEFAULT_TREE = {
  size: 94,
  color: '#2e2e2e'
} as const;

const treeSpriteCache = new Map<string, TreeSprite>();

function normalizeTreeOptions(options: TreeOptions): NormalizedTreeOptions {
  const { size, color } = options;
  return {
    size: typeof size === 'number' && Number.isFinite(size) && size > 0 ? size : DEFAULT_TREE.size,
    color: typeof color === 'string' ? color : DEFAULT_TREE.color
  };
}

function makeCacheKey(config: NormalizedTreeOptions): string {
  return `s:${config.size}|c:${config.color}`;
}

function computeTreeMetrics(config: NormalizedTreeOptions): TreeMetrics {
  // Scale pattern with square pixels based on `size`.
  const PATTERN_MAX_WIDTH = Math.max(...tree1.map(r => r.length));
  const PATTERN_TOTAL_ROWS = tree1.length;

  // Choose cell size from requested `size`
  const cell = Math.max(1, Math.round((config.size * 2) / PATTERN_MAX_WIDTH)); // ~2*size pixels wide overall
  const width = PATTERN_MAX_WIDTH * cell + TREE_PADDING_X * 2;
  const height = (PATTERN_TOTAL_ROWS * cell + TREE_PADDING_TOP + TREE_PADDING_BOTTOM) * 1.5;

  return {
    width,
    height,
    centerX: Math.round(width / 2),
    baseY: height - TREE_PADDING_BOTTOM
  };
}

function createTreeSprite(config: NormalizedTreeOptions, metrics: TreeMetrics): TreeSprite | null {
  let canvas: HTMLCanvasElement | OffscreenCanvas | null = null;

  if (typeof OffscreenCanvas === 'function') {
    canvas = new OffscreenCanvas(metrics.width, metrics.height);
  } else if (typeof document !== 'undefined') {
    const el = document.createElement('canvas');
    el.width = metrics.width;
    el.height = metrics.height;
    canvas = el;
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
  const PATTERN_MAX_WIDTH = Math.max(...tree1.map(r => r.length));
  const PATTERN_TOTAL_ROWS = tree1.length;
  if (PATTERN_MAX_WIDTH <= 0 || PATTERN_TOTAL_ROWS <= 0) return;

  const c = ctx.canvas as any;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = config.color;
  ctx.imageSmoothingEnabled = false;

  // Square cells derived from metrics
  const cellWidth = (metrics.width - TREE_PADDING_X * 2) / PATTERN_MAX_WIDTH;
  const cellHeight = (metrics.baseY - TREE_PADDING_TOP) / PATTERN_TOTAL_ROWS;

  for (let rowIndex = 0; rowIndex < tree1.length; rowIndex++) {
    const row = tree1[rowIndex];
    const rowWidth = row.length * cellWidth;
    const baseLeft = metrics.centerX - rowWidth / 2;
    const top = TREE_PADDING_TOP + rowIndex * cellHeight;

    for (let i = 0; i < row.length; i++) {
      if (row[i] !== '1') continue;
      const x = Math.round(baseLeft + i * cellWidth);
      const y = Math.round(top);
      const w = Math.max(1, Math.round(baseLeft + (i + 1) * cellWidth) - x);
      const h = Math.max(1, Math.round(top + cellHeight) - y);
      ctx.fillRect(x, y, w, h);
    }
  }
}

export function drawTree(ctx: CanvasRenderingContext2D, options: TreeOptions): void {
  if (!Number.isFinite(options.x)) return;

  const { x, groundY, cameraY } = options;
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
