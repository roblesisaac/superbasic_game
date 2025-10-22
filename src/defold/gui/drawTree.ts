export type TreeKey = 'tree1' | 'tree2' | (string & {});
import { TREE1 } from '../modules/trees/tree1.js';
import { TREE2 } from '../modules/trees/tree2.js';

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

/** Register/override a tree at runtime. */
export function registerTree(key: string, pattern: string[]): void {
  TREES[key] = pattern;
}
