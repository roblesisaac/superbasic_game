export type TreeKey = 'tree1' | 'tree2' | (string & {});
import { TREE1 } from '../../../modules/trees/tree1.js';
import { TREE2 } from '../../../modules/trees/tree2.js';

const TREES: Record<string, string[]> = {
  tree1: TREE1,
  tree2: TREE2,
};

export interface DrawTreeConfig {
  /** Which tree to draw. Defaults to 'tree1'. */
  tree?: TreeKey;

  /** Anchor position on the canvas. Interpretation depends on `align`. */
  x: number;
  y: number;

  /** Base size of each pixel “cell” in CSS px. Default: 4 */
  pixelSize?: number;

  /** Global alpha for the tree. Default: 1 */
  alpha?: number;

  /**
   * Alignment relative to (x, y):
   * - 'top-left': (x,y) is top-left of the bitmap
   * - 'center':   (x,y) is the center of the bitmap
   * - 'bottom':   (x,y) is the bottom-center (useful to place at ground)
   * Default: 'bottom'
   */
  align?: 'top-left' | 'center' | 'bottom';

  /**
   * Non-uniform stretch scales for width/height. Default: 1 and 1.5
   * These multiply the base pixel size on each axis.
   */
  widthScale?: number;
  heightScale?: number;

  /**
   * Brightness tuning:
   * - brighten: 0..1 moves color toward white
   * - darken:   0..1 moves color toward black
   * Net effect = brighten - darken (clamped to [-1, 1]).
   */
  brighten?: number;
  darken?: number;
}

/** Adjust a hex color by net amount in [-1, 1]. Positive brightens, negative darkens. */
function adjustHex(hex: string, net: number): string {
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const n = Math.max(-1, Math.min(1, net));
  const c = parseInt(hex.slice(1), 16);
  let r = (c >> 16) & 255;
  let g = (c >> 8) & 255;
  let b = c & 255;

  const adj = (ch: number) =>
    n >= 0
      ? ch + (255 - ch) * n
      : ch * (1 + n); // n negative → darken

  r = Math.round(clamp01(adj(r) / 255) * 255);
  g = Math.round(clamp01(adj(g) / 255) * 255);
  b = Math.round(clamp01(adj(b) / 255) * 255);

  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Draws a bitmap tree to the provided 2D context.
 * '1' pixels use base #2f2f2f, '3' pixels use base #4c4c4c; spaces are transparent.
 * Brighten/darken are applied to both bases.
 */
export function drawTree(
  ctx: CanvasRenderingContext2D,
  config: DrawTreeConfig
): void {
  const {
    tree = 'tree1',
    x,
    y,
    pixelSize = 4,
    alpha = 1,
    align = 'bottom',
    widthScale = 1,
    heightScale = 1.5,
    brighten = 0,
    darken = 0,
  } = config;

  const BASE_1 = '#2f2f2f';
  const BASE_3 = '#4c4c4c';
  const net = Math.max(-1, Math.min(1, brighten - darken));
  const color1 = adjustHex(BASE_1, net);
  const color3 = adjustHex(BASE_3, net);

  const pattern = TREES[tree] ?? TREES['tree1'];
  if (!pattern || pattern.length === 0) return;

  const rows = pattern.length;
  const cols = Math.max(...pattern.map((r) => r.length));

  const cellW = pixelSize * widthScale;
  const cellH = pixelSize * heightScale;

  // Compute anchor offset based on alignment
  let originX = x;
  let originY = y;

  if (align === 'center') {
    originX = Math.round(x - (cols * cellW) / 2);
    originY = Math.round(y - (rows * cellH) / 2);
  } else if (align === 'bottom') {
    originX = Math.round(x - (cols * cellW) / 2);
    originY = Math.round(y - rows * cellH);
  } // 'top-left' uses (x, y) as-is

  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  for (let r = 0; r < rows; r++) {
    const line = pattern[r];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '1' || ch === '3') {
        ctx.fillStyle = ch === '1' ? color1 : color3;
        const px = originX + c * cellW;
        const py = originY + r * cellH;
        ctx.fillRect(px, py, cellW, cellH);
      }
    }
  }

  ctx.globalAlpha = prevAlpha;
}

export interface TreeVisualStyle {
  tree?: TreeKey;
  pixelSize?: number;
  alpha?: number;
  widthScale?: number;
  heightScale?: number;
  brighten?: number;
  darken?: number;
}

type NormalizedTreeVisualStyle = {
  tree: TreeKey;
  pixelSize: number;
  alpha: number;
  widthScale: number;
  heightScale: number;
  brighten: number;
  darken: number;
};

function normalizeTreeStyle(style: TreeVisualStyle = {}): NormalizedTreeVisualStyle {
  const {
    tree = 'tree1',
    pixelSize = 4,
    alpha = 1,
    widthScale = 1,
    heightScale = 1.5,
    brighten = 0,
    darken = 0,
  } = style;

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const positive = (v: number, fallback: number) =>
    Number.isFinite(v) && v !== undefined && v > 0 ? v : fallback;

  return {
    tree,
    pixelSize: positive(pixelSize, 4),
    alpha: clamp01(Number.isFinite(alpha) ? alpha : 1),
    widthScale: positive(widthScale, 1),
    heightScale: positive(heightScale, 1.5),
    brighten: clamp01(Number.isFinite(brighten) ? brighten : 0),
    darken: clamp01(Number.isFinite(darken) ? darken : 0),
  };
}

export function getTreePattern(tree: TreeKey): string[] {
  return TREES[tree] ?? TREES['tree1'] ?? [];
}

function computeTreeDimensions(style: NormalizedTreeVisualStyle): { width: number; height: number } {
  const pattern = getTreePattern(style.tree);
  if (!pattern.length) return { width: 0, height: 0 };

  const rows = pattern.length;
  const cols = Math.max(...pattern.map((line) => line.length), 0);
  const width = Math.ceil(cols * style.pixelSize * style.widthScale);
  const height = Math.ceil(rows * style.pixelSize * style.heightScale);
  return { width, height };
}

export function measureTree(style: TreeVisualStyle = {}): { width: number; height: number } {
  const normalized = normalizeTreeStyle(style);
  return computeTreeDimensions(normalized);
}

export function createTreeBitmap(style: TreeVisualStyle = {}): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
} {
  if (typeof document === 'undefined') {
    throw new Error('Tree bitmaps require a DOM document to create canvases.');
  }

  const normalized = normalizeTreeStyle(style);
  const { width, height } = computeTreeDimensions(normalized);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  if (width === 0 || height === 0) {
    return { canvas, width, height };
  }

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to acquire 2D context for tree bitmap.');
  }

  drawTree(context, {
    tree: normalized.tree,
    pixelSize: normalized.pixelSize,
    alpha: normalized.alpha,
    widthScale: normalized.widthScale,
    heightScale: normalized.heightScale,
    brighten: normalized.brighten,
    darken: normalized.darken,
    x: 0,
    y: 0,
    align: 'top-left',
  });

  return { canvas, width, height };
}

/** Register/override a tree at runtime. */
export function registerTree(key: string, pattern: string[]): void {
  TREES[key] = pattern;
}
