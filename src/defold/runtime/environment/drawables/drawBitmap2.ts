// ---- Caching + prerender helpers (sync) ------------------------------------
type BitmapCacheKey = string;
type SpriteSource = HTMLCanvasElement | OffscreenCanvas;
const _bitmapCache = new Map<BitmapCacheKey, SpriteSource>();

function cacheKey(
  pattern: string[],
  colorMap: Record<string, string>,
  defaultColor: string,
  transparent: string,
  net: number,
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
  let r = (c >> 16) & 255,
    g = (c >> 8) & 255,
    b = c & 255;
  const adj = (ch: number) => (n >= 0 ? ch + (255 - ch) * n : ch * (1 + n));
  r = Math.round(clamp01(adj(r) / 255) * 255);
  g = Math.round(clamp01(adj(g) / 255) * 255);
  b = Math.round(clamp01(adj(b) / 255) * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
    .toString(16)
    .padStart(2, "0")}`;
}

// Synchronous prerender: returns a canvas you can drawImage() with
function prerenderBitmapToCanvas(
  pattern: string[],
  colorMap: Record<string, string>,
  defaultColor: string,
  transparentChars: string,
  net: number,
): SpriteSource {
  const rows = pattern.length;
  const cols = Math.max(...pattern.map((r) => r.length));

  const off: SpriteSource =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(cols, rows)
      : (() => {
          const c = document.createElement("canvas");
          c.width = cols;
          c.height = rows;
          return c;
        })();

  const ctx = (off as any).getContext("2d", {
    willReadFrequently: true,
  }) as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

  const img = ctx.createImageData(cols, rows);
  const data = img.data;

  // Pre-adjust all mapped colors (fewer ops per pixel)
  const adjustedMap: Record<string, [number, number, number, number]> = {};
  for (const [k, v] of Object.entries(colorMap)) {
    adjustedMap[k] = hexToRGBA(net === 0 ? v : adjustHex(v, net));
  }
  const adjustedDefault = hexToRGBA(
    net === 0 ? defaultColor : adjustHex(defaultColor, net),
  );

  for (let y = 0; y < rows; y++) {
    const line = pattern[y] ?? "";
    for (let x = 0; x < cols; x++) {
      const rawCh = line[x];
      const ch = rawCh ?? " ";
      const colorKey =
        rawCh === undefined || ch.trim().length === 0 ? "null" : ch;
      const hasMappedColor = Object.prototype.hasOwnProperty.call(
        adjustedMap,
        colorKey,
      );
      const idx = (y * cols + x) * 4;

      const shouldSkip =
        !hasMappedColor &&
        (rawCh === undefined
          ? transparentChars.includes(" ")
          : transparentChars.includes(ch));

      if (shouldSkip) {
        data[idx + 3] = 0; // transparent
        continue;
      }

      const rgba = hasMappedColor ? adjustedMap[colorKey] : adjustedDefault;
      data[idx + 0] = rgba[0];
      data[idx + 1] = rgba[1];
      data[idx + 2] = rgba[2];
      data[idx + 3] = rgba[3];
    }
  }

  ctx.putImageData(img, 0, 0);
  return off;
}

// ---- Utilities --------------------------------------------------------------
function normalizeToLines(value?: string | string[]): string[] | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value;
  return value.split(/\r?\n/);
}

// ---- Built-in grayscale map (0..9) -----------------------------------------
const DIGIT_COLOR_MAP: Record<string, string> = {
    "0": "#CCCCCC",
    "1": "#AAAAAA",
    "2": "#888888",
    "3": "#666666",
    "4": "#222222",
    "5": "#333333",
    "6": "#222222",
    "7": "#222222",
    "8": "#111111",
    "9": "#111111",
};  

// ---- Synchronous drawBitmap2 (no await anywhere) ----------------------------
export function drawBitmap2(
  ctx: CanvasRenderingContext2D,
  config: {
    // You will import raw txt on top and pass it in here:
    pattern?: string[] | string; // preferred: pass raw string from `?raw` and let us split
    txt?: string;                // alias of pattern as raw string (optional)

    x: number;
    y: number;
    align?: "top-left" | "center" | "bottom";

    pixelSize?: number;
    widthScale?: number;
    heightScale?: number;
    alpha?: number;

    colorMap?: Record<string, string>;
    defaultColor?: string;
    brighten?: number;
    darken?: number;
    transparentChars?: string;
  },
): void {
  const {
    pattern: patternIn,
    txt,
    x,
    y,
    pixelSize = 4,
    alpha = 1,
    align = "bottom",
    widthScale = 1,
    heightScale = 1.5,

    // Merge with digit map; your overrides win
    colorMap = {},
    defaultColor = DIGIT_COLOR_MAP["1"],
    brighten = 0,
    darken = 0,
    transparentChars = " ",
  } = config;

  // Resolve pattern synchronously (no fetch)
  const pattern =
    normalizeToLines(patternIn) ??
    normalizeToLines(txt);

  if (!pattern || pattern.length === 0) return;

  const rows = pattern.length;
  const cols = Math.max(...pattern.map((r) => r.length));
  const cellW = pixelSize * widthScale;
  const cellH = pixelSize * heightScale;

  const effectiveMap: Record<string, string> = {
    ...DIGIT_COLOR_MAP,
    ...colorMap,
  };

  const net = Math.max(-1, Math.min(1, brighten - darken));
  const key = cacheKey(pattern, effectiveMap, defaultColor, transparentChars, net);

  let sprite = _bitmapCache.get(key);
  if (!sprite) {
    sprite = prerenderBitmapToCanvas(
      pattern,
      effectiveMap,
      defaultColor,
      transparentChars,
      net,
    );
    _bitmapCache.set(key, sprite);
  }

  // Alignment
  const drawW = cols * cellW;
  const drawH = rows * cellH;

  let originX = x;
  let originY = y;

  if (align === "center") {
    originX = Math.round(x - drawW / 2);
    originY = Math.round(y - drawH / 2);
  } else if (align === "bottom") {
    originX = Math.round(x - drawW / 2);
    originY = Math.round(y - drawH);
  }

  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.imageSmoothingEnabled = false; // keep pixels crisp

  // Draw in strict call order (sync)
  ctx.drawImage(sprite as CanvasImageSource, originX, originY, drawW, drawH);

  ctx.globalAlpha = prevAlpha;
}
