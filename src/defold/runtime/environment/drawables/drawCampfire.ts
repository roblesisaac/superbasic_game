import { FIRE_BITMAP } from '../../../modules/bitmaps/fire-bitmap.js';

const COLOR_MAP: Record<string, string> = {
  '0': '#ffffff',
  '1': '#ffffff',
  '2': '#e6e6e6',
  '3': '#bfbfbf',
  '4': '#8c8c8c',
  '5': '#5a5a5a',
  '6': '#3b3b3b',
  '7': '#777777',
  '8': '#d9d9d9',
  '9': '#f3f3f3'
};

const TRANSPARENT_INDEX = 10;

const isLittleEndian =
  new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44;

function hexToPaletteValue(hex: string | undefined): number {
  if (!hex) return 0x00000000;
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return isLittleEndian
    ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
    : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
}

const PALETTE = new Uint32Array(TRANSPARENT_INDEX + 1);
for (let digit = 0; digit <= 9; digit += 1) {
  PALETTE[digit] = hexToPaletteValue(COLOR_MAP[String(digit)]);
}
PALETTE[TRANSPARENT_INDEX] = 0x00000000;

const SPRITE = FIRE_BITMAP;
const SPRITE_WIDTH = SPRITE[0]?.length ?? 0;
const SPRITE_HEIGHT = SPRITE.length;

const Y_OFFSET = 16;
const SOURCE_WIDTH = SPRITE_WIDTH;
const SOURCE_HEIGHT = SPRITE_HEIGHT + Y_OFFSET;

const SCALE = 0.85;
const LOGICAL_WIDTH = Math.max(32, Math.floor(SOURCE_WIDTH * SCALE));
const LOGICAL_HEIGHT = Math.max(32, Math.floor(SOURCE_HEIGHT * SCALE));

const SPARK_MAX = 40;
const SPARK_SPAWN_PER_FRAME = 1;
const SPARK_LIFE_MIN = 24;
const SPARK_LIFE_MAX = 56;
const SPARK_SPEED_Y = -0.2;
const SPARK_SPEED_X = 0.1;
const SPARK_WOBBLE = 0.12;

const TARGET_FRAME_TIME = 1000 / 60;
const DEFAULT_PIXEL_SIZE = 1.35;

let base: Uint8Array | null = null;
let sparkField: Uint8Array | null = null;
let topSamples: Array<{ x: number; y: number }> = [];
let topCenter: { cx: number; band: Array<{ x: number; y: number }> } | null =
  null;

let campfireCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
let campfireCtx:
  | OffscreenCanvasRenderingContext2D
  | CanvasRenderingContext2D
  | null = null;
let campfireImageData: ImageData | null = null;
let campfirePixels: Uint32Array | null = null;

let lastTimestamp = 0;
let frameAccumulator = 0;
let imageDirty = true;

const s_x = new Float32Array(SPARK_MAX);
const s_y = new Float32Array(SPARK_MAX);
const s_vx = new Float32Array(SPARK_MAX);
const s_vy = new Float32Array(SPARK_MAX);
const s_age = new Uint16Array(SPARK_MAX);
const s_life = new Uint16Array(SPARK_MAX);
const s_on = new Uint8Array(SPARK_MAX);

function ensureBase(): void {
  if (base) return;

  base = new Uint8Array(SOURCE_WIDTH * SOURCE_HEIGHT);
  base.fill(TRANSPARENT_INDEX);

  for (let y = 0; y < SPRITE_HEIGHT; y += 1) {
    const row = SPRITE[y];
    for (let x = 0; x < SPRITE_WIDTH; x += 1) {
      const char = row?.[x] ?? ' ';
      const dst = (y + Y_OFFSET) * SOURCE_WIDTH + x;
      base[dst] =
        char === ' ' || char === '.'
          ? TRANSPARENT_INDEX
          : Math.max(0, char.charCodeAt(0) - 48);
    }
  }

  sparkField = new Uint8Array(SOURCE_WIDTH * SOURCE_HEIGHT);
  topSamples = computeTopContour();
  topCenter = recomputeTopCenter(5);

  ensureCanvas();
}

function ensureCanvas(): void {
  if (campfireCanvas && campfireCtx && campfireImageData && campfirePixels) {
    return;
  }

  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(LOGICAL_WIDTH, LOGICAL_HEIGHT)
      : (() => {
          if (typeof document === 'undefined') {
            return null;
          }
          const node = document.createElement('canvas');
          node.width = LOGICAL_WIDTH;
          node.height = LOGICAL_HEIGHT;
          return node;
        })();

  if (!canvas) {
    throw new Error('Unable to create canvas for campfire rendering.');
  }

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    throw new Error('Unable to get 2d context for campfire rendering.');
  }

  const imageData = context.createImageData(LOGICAL_WIDTH, LOGICAL_HEIGHT);
  const pixels = new Uint32Array(imageData.data.buffer);

  campfireCanvas = canvas;
  campfireCtx = context;
  campfireImageData = imageData;
  campfirePixels = pixels;
  imageDirty = true;
}

function computeTopContour(): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let x = 0; x < SPRITE_WIDTH; x += 1) {
    let y = 0;
    while (
      y < SPRITE_HEIGHT &&
      (SPRITE[y]?.[x] === ' ' || SPRITE[y]?.[x] === '.')
    ) {
      y += 1;
    }
    if (y < SPRITE_HEIGHT) {
      points.push({ x, y });
    }
  }
  return points;
}

function recomputeTopCenter(windowHalfWidth = 5): {
  cx: number;
  band: Array<{ x: number; y: number }>;
} {
  if (topSamples.length === 0) {
    topSamples = computeTopContour();
  }
  const cx =
    topSamples.reduce((sum, point) => sum + point.x, 0) /
    Math.max(1, topSamples.length);
  const roundedCx = Math.round(cx);
  const band = topSamples.filter(
    (point) => Math.abs(point.x - roundedCx) <= windowHalfWidth
  );
  return { cx: roundedCx, band: band.length > 0 ? band : topSamples };
}

function spawnSpark(): void {
  const idx = s_on.indexOf(0);
  if (idx === -1) return;

  topCenter = recomputeTopCenter(5);
  const band = topCenter.band.length > 0 ? topCenter.band : topSamples;
  const pick = band[(Math.random() * band.length) | 0];
  const jitterX =
    (Math.random() - 0.5 + (Math.random() - 0.5)) * 1.0;

  s_x[idx] = pick.x + jitterX;
  s_y[idx] = Math.max(0, pick.y + Y_OFFSET - 2);
  s_vx[idx] =
    (Math.random() - 0.5 + (Math.random() - 0.5)) * SPARK_SPEED_X;
  s_vy[idx] = SPARK_SPEED_Y * (0.85 + Math.random() * 0.3);
  s_age[idx] = 0;
  s_life[idx] =
    (SPARK_LIFE_MIN +
      Math.random() * (SPARK_LIFE_MAX - SPARK_LIFE_MIN)) |
    0;
  s_on[idx] = 1;
}

function updateSparks(): void {
  if (!sparkField) return;

  for (let i = 0; i < sparkField.length; i += 1) {
    if (sparkField[i] > 0) {
      sparkField[i] -= 1;
    }
  }

  const count = (Math.random() * (SPARK_SPAWN_PER_FRAME * 2)) | 0;
  for (let i = 0; i < count; i += 1) {
    spawnSpark();
  }

  for (let i = 0; i < SPARK_MAX; i += 1) {
    if (!s_on[i]) continue;

    s_age[i] += 1;
    if (s_age[i] > s_life[i]) {
      s_on[i] = 0;
      continue;
    }

    const wobble = Math.sin(s_age[i] * 0.3 + i * 0.7) * SPARK_WOBBLE;
    s_vx[i] += wobble * 0.02;
    s_y[i] += s_vy[i];
    s_x[i] += s_vx[i];

    if (
      s_x[i] < 0 ||
      s_x[i] >= SOURCE_WIDTH ||
      s_y[i] < 0 ||
      s_y[i] >= SOURCE_HEIGHT
    ) {
      s_on[i] = 0;
      continue;
    }

    const xi = s_x[i] | 0;
    const yi = s_y[i] | 0;
    sparkField[yi * SOURCE_WIDTH + xi] = 3;
  }

  imageDirty = true;
}

function renderDownscaled(): void {
  if (!base || !sparkField || !campfirePixels || !campfireImageData) return;

  const invSx = SOURCE_WIDTH / LOGICAL_WIDTH;
  const invSy = SOURCE_HEIGHT / LOGICAL_HEIGHT;

  for (let y = 0; y < LOGICAL_HEIGHT; y += 1) {
    const sy = Math.floor(y * invSy);
    for (let x = 0; x < LOGICAL_WIDTH; x += 1) {
      const sx = Math.floor(x * invSx);
      const srcIndex = sy * SOURCE_WIDTH + sx;
      const spark = sparkField[srcIndex];

      if (spark) {
        const d3 = COLOR_MAP['9'] ? 9 : 1;
        const d2 = COLOR_MAP['8'] ? 8 : d3;
        const d1 = COLOR_MAP['7'] ? 7 : d2;
        campfirePixels[y * LOGICAL_WIDTH + x] =
          PALETTE[spark === 3 ? d3 : spark === 2 ? d2 : d1];
      } else {
        campfirePixels[y * LOGICAL_WIDTH + x] = PALETTE[base[srcIndex]];
      }
    }
  }

  campfireCtx?.putImageData(campfireImageData, 0, 0);
  imageDirty = false;
}

function stepSimulation(): void {
  updateSparks();
}

interface DrawCampfireOptions {
  x: number;
  groundLineY: number;
  timestamp: number;
  pixelSize?: number;
}

export function drawCampfire(
  ctx: CanvasRenderingContext2D,
  options: DrawCampfireOptions
): void {
  ensureBase();
  if (!campfireCanvas) return;

  const { x, groundLineY, timestamp, pixelSize = DEFAULT_PIXEL_SIZE } = options;

  if (!Number.isFinite(timestamp)) {
    stepSimulation();
  } else {
    if (lastTimestamp === 0) {
      lastTimestamp = timestamp;
    }
    const delta = Math.max(0, timestamp - lastTimestamp);
    lastTimestamp = timestamp;

    frameAccumulator += delta;
    const maxSteps = 5;
    let steps = 0;
    while (frameAccumulator >= TARGET_FRAME_TIME && steps < maxSteps) {
      stepSimulation();
      frameAccumulator -= TARGET_FRAME_TIME;
      steps += 1;
    }

    if (steps === 0) {
      stepSimulation();
    }
  }

  if (imageDirty) {
    renderDownscaled();
  }

  const drawWidth = LOGICAL_WIDTH * pixelSize;
  const drawHeight = LOGICAL_HEIGHT * pixelSize;
  const destX = Math.round(x - drawWidth / 2);
  const destY = Math.round(groundLineY - drawHeight);

  const previousSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    campfireCanvas as CanvasImageSource,
    destX,
    destY,
    drawWidth,
    drawHeight
  );
  ctx.imageSmoothingEnabled = previousSmoothing;
}
