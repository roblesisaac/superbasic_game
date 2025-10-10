interface PixelDefinition {
  x: number;
  y: number;
  size: number;
}

export type DisintegrateMode = 'disintegrate' | 'integrate';

export interface DisintegrateEffectOptions {
  pixels: PixelDefinition[];
  color: string;
  interval?: number;
  mode?: DisintegrateMode;
}

const DEFAULT_INTERVAL = 0.018;

interface AnimatedPixel extends PixelDefinition {
  orderTimestamp: number;
}

export class DisintegrateEffect {
  private pixels: AnimatedPixel[];
  private color: string;
  private elapsed = 0;
  private totalDuration: number;
  private mode: DisintegrateMode;

  constructor({ pixels, color, interval = DEFAULT_INTERVAL, mode = 'disintegrate' }: DisintegrateEffectOptions) {
    const orderedPixels = shufflePixels(pixels, interval);
    this.pixels = orderedPixels;
    this.color = color;
    this.mode = mode;
    this.totalDuration = orderedPixels.length === 0 ? 0 : orderedPixels[orderedPixels.length - 1].orderTimestamp + interval;
  }

  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.elapsed += dt;
  }

  draw(ctx: CanvasRenderingContext2D, offsetY = 0): void {
    if (this.pixels.length === 0) return;

    ctx.save();
    ctx.fillStyle = this.color;

    for (const pixel of this.pixels) {
      const shouldDraw =
        this.mode === 'disintegrate'
          ? this.elapsed < pixel.orderTimestamp
          : this.elapsed >= pixel.orderTimestamp;

      if (!shouldDraw) continue;

      ctx.fillRect(pixel.x, pixel.y - offsetY, pixel.size, pixel.size);
    }

    ctx.restore();
  }

  isFinished(): boolean {
    return this.elapsed >= this.totalDuration;
  }
}

function shufflePixels(pixels: PixelDefinition[], interval: number): AnimatedPixel[] {
  const indices = pixels.map((_, index) => index);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices.map((originalIndex, order) => {
    const pixel = pixels[originalIndex];
    return {
      ...pixel,
      orderTimestamp: (order + 1) * interval
    };
  });
}

export function buildPixelsFromPattern(
  rect: { x: number; y: number; width: number; height: number },
  pixelSize: number,
  pattern: ReadonlyArray<ReadonlyArray<number>>
): PixelDefinition[] {
  const pixels: PixelDefinition[] = [];
  const baseSize = Math.max(1, pixelSize);

  for (let row = 0; row < pattern.length; row += 1) {
    const patternRow = pattern[row];
    for (let col = 0; col < patternRow.length; col += 1) {
      if (patternRow[col] !== 1) continue;
      pixels.push({
        x: rect.x + col * baseSize,
        y: rect.y + row * baseSize,
        size: baseSize
      });
    }
  }

  return pixels;
}

export function buildPixelsForRect(
  rect: { x: number; y: number; width: number; height: number },
  pixelSize: number
): PixelDefinition[] {
  const pixels: PixelDefinition[] = [];
  const size = Math.max(1, pixelSize);
  const cols = Math.max(1, Math.floor(rect.width / size));
  const rows = Math.max(1, Math.floor(rect.height / size));

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      pixels.push({
        x: rect.x + col * size,
        y: rect.y + row * size,
        size
      });
    }
  }

  return pixels;
}
