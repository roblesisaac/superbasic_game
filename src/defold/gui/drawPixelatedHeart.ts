/**
 * Draws a pixelated heart on a canvas context.
 * The heart is an 8x7 grid (8 columns, 7 filled rows) of pixel blocks.
 *
 * @param ctx - Canvas 2D context to draw on.
 * @param x - Top-left x coordinate.
 * @param y - Top-left y coordinate.
 * @param pixelSize - Size of each pixel block.
 * @param color - Fill color for the heart.
 */
const HEART_BOB_PERIOD_MS = 2000;
const HEART_BOB_AMPLITUDE_RATIO = 0.6;

export function drawPixelatedHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pixelSize: number,
  color = '#ff0000',
): void {
  ctx.fillStyle = color;

  for (let row = 0; row < HEART_PATTERN.length; row += 1) {
    for (let col = 0; col < HEART_PATTERN[row].length; col += 1) {
      if (HEART_PATTERN[row][col] !== 1) continue;
      ctx.fillRect(
        x + col * pixelSize,
        y + row * pixelSize,
        pixelSize,
        pixelSize,
      );
    }
  }
}

export function computeHeartBobOffset(
  timeMs: number,
  pixelSize: number,
  phaseSeed = 0,
): number {
  if (!Number.isFinite(pixelSize) || pixelSize <= 0) return 0;

  const amplitude = Math.max(1, Math.round(pixelSize * HEART_BOB_AMPLITUDE_RATIO));
  if (amplitude <= 0) return 0;

  const period = HEART_BOB_PERIOD_MS;
  const baseTime = Number.isFinite(timeMs) ? timeMs : 0;
  const seedComponent = Number.isFinite(phaseSeed) ? phaseSeed % period : 0;
  const phase = ((baseTime + seedComponent + period) % period) / period;
  const offset = Math.sin(phase * Math.PI * 2) * amplitude;
  return Math.round(offset);
}

export const HEART_PATTERN: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 1, 1, 0, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

export const HEART_PIXEL_COLUMNS = HEART_PATTERN[0]?.length ?? 0;
export const HEART_PIXEL_ROWS = HEART_PATTERN.filter((row) => row.some((cell) => cell === 1)).length;
