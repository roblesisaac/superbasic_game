import { CABIN_BITMAP } from '../../../assets/bitmaps/cabin.js';

const BUILTIN_BITMAPS: Record<string, string[]> = {
  cabin: CABIN_BITMAP
};

// ---- Caching + prerender helpers -------------------------------------------
type BitmapCacheKey = string;
const _bitmapCache = new Map<BitmapCacheKey, ImageBitmap>();

function cacheKey(
  pattern: string[],
  colorMap: Record<string,string>,
  defaultColor: string,
  transparent: string,
  net: number
): BitmapCacheKey {
  return JSON.stringify({ pattern, colorMap, defaultColor, transparent, net });
}

function hexToRGBA(hex: string): [number, number, number, number] {
  const c = parseInt(hex.slice(1), 16);
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255, 255];
}

function adjustHex(hex: string, net: number): string {
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const n = Math.max(-1, Math.min(1, net));
  const c = parseInt(hex.slice(1), 16);
  let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const adj = (ch: number) => (n >= 0 ? ch + (255 - ch) * n : ch * (1 + n));
  r = Math.round(clamp01(adj(r) / 255) * 255);
  g = Math.round(clamp01(adj(g) / 255) * 255);
  b = Math.round(clamp01(adj(b) / 255) * 255);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

async function prerenderBitmapToImageBitmap(
  pattern: string[],
  colorMap: Record<string, string>,
  defaultColor: string,
  transparentChars: string,
  net: number
): Promise<ImageBitmap> {
  const rows = pattern.length;
  const cols = Math.max(...pattern.map(r => r.length));

  // OffscreenCanvas if available; fallback to regular canvas
  const off =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(cols, rows)
      : (() => {
          const c = document.createElement('canvas');
          c.width = cols; c.height = rows;
          return c as unknown as OffscreenCanvas;
        })();

  const ctx = (off as any).getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  const img = ctx.createImageData(cols, rows);
  const data = img.data;

  // Pre-adjust all mapped colors (fewer ops in the inner loop)
  const adjustedMap: Record<string, [number,number,number,number]> = {};
  for (const [k, v] of Object.entries(colorMap)) {
    adjustedMap[k] = hexToRGBA(net === 0 ? v : adjustHex(v, net));
  }
  const adjustedDefault = hexToRGBA(net === 0 ? defaultColor : adjustHex(defaultColor, net));

  for (let y = 0; y < rows; y++) {
    const line = pattern[y];
    for (let x = 0; x < cols; x++) {
      const rawCh = line[x];
      const ch = rawCh ?? ' ';
      const colorKey =
        rawCh === undefined || ch.trim().length === 0 ? 'null' : ch;
      const hasMappedColor = Object.prototype.hasOwnProperty.call(adjustedMap, colorKey);
      const idx = (y * cols + x) * 4;

      const shouldSkip =
        !hasMappedColor &&
        (rawCh === undefined
          ? transparentChars.includes(' ')
          : transparentChars.includes(ch));

      if (shouldSkip) {
        data[idx+3] = 0; // fully transparent
        continue;
      }

      const rgba = hasMappedColor ? adjustedMap[colorKey] : adjustedDefault;
      data[idx+0] = rgba[0];
      data[idx+1] = rgba[1];
      data[idx+2] = rgba[2];
      data[idx+3] = rgba[3];
    }
  }

  ctx.putImageData(img, 0, 0);
  // Convert to ImageBitmap for fast blits (on Safari this is a no-op but harmless)
  return await createImageBitmap(off as any);
}

// ---- Optimized drawBitmap (blitting) ----------------------------------------
export async function drawBitmap(
  ctx: CanvasRenderingContext2D,
  config: {
    bitmap?: string;
    pattern?: string[];
    x: number; y: number;
    pixelSize?: number;
    alpha?: number;
    align?: 'top-left'|'center'|'bottom';
    widthScale?: number;
    heightScale?: number;
    colorMap?: Record<string,string>;
    defaultColor?: string;
    brighten?: number;
    darken?: number;
    transparentChars?: string;
  }
): Promise<void> {
  const {
    bitmap,
    pattern: patternIn,
    x, y,
    pixelSize = 4,
    alpha = 1,
    align = 'bottom',
    widthScale = 1,
    heightScale = 1.5,
    // Provide a "null" key to color otherwise empty / undefined / whitespace pixels.
    colorMap = { '1': '#2f2f2f', '3': '#4c4c4c' },
    defaultColor = '#2f2f2f',
    brighten = 0,
    darken = 0,
    transparentChars = ' ',
  } = config;

  const pattern = patternIn ?? (bitmap ? BUILTIN_BITMAPS[bitmap] : undefined);
  if (!pattern || pattern.length === 0) return;

  const rows = pattern.length;
  const cols = Math.max(...pattern.map((r) => r.length));

  const cellW = pixelSize * widthScale;
  const cellH = pixelSize * heightScale;

  const net = Math.max(-1, Math.min(1, brighten - darken));
  const key = cacheKey(pattern, colorMap, defaultColor, transparentChars, net);

  let sprite = _bitmapCache.get(key);
  if (!sprite) {
    sprite = await prerenderBitmapToImageBitmap(
      pattern,
      colorMap,
      defaultColor,
      transparentChars,
      net
    );
    _bitmapCache.set(key, sprite);
  }

  // alignment
  let originX = x;
  let originY = y;
  const drawW = cols * cellW;
  const drawH = rows * cellH;

  if (align === 'center') {
    originX = Math.round(x - drawW / 2);
    originY = Math.round(y - drawH / 2);
  } else if (align === 'bottom') {
    originX = Math.round(x - drawW / 2);
    originY = Math.round(y - drawH);
  }

  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.imageSmoothingEnabled = false; // preserve crisp pixels

  ctx.drawImage(sprite, originX, originY, drawW, drawH);

  ctx.globalAlpha = prevAlpha;
}
