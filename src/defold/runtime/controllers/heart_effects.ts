import { HEART_PATTERN } from '../../gui/drawPixelatedHeart.js';
import {
  onHeartPickupKilled,
  type HeartPickup,
  type HeartPickupEventPayload
} from '../../game_objects/heartPickup.js';

interface HeartDisintegratePixel {
  x: number;
  y: number;
  size: number;
  eraseAt: number;
}

interface HeartDisintegrateEffectOptions {
  rect: { x: number; y: number; width: number; height: number };
  pixelSize: number;
  color: string;
}

const PIXEL_ERASE_INTERVAL = 0.018;

class HeartDisintegrateEffect {
  private pixels: HeartDisintegratePixel[];
  private color: string;
  private elapsed = 0;
  private totalDuration: number;

  constructor({ rect, pixelSize, color }: HeartDisintegrateEffectOptions) {
    this.color = color;
    this.pixels = this._createPixels(rect, pixelSize);
    this.totalDuration = PIXEL_ERASE_INTERVAL * (this.pixels.length + 1);
  }

  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.elapsed += dt;
  }

  draw(ctx: CanvasRenderingContext2D, cameraY: number): void {
    if (this.pixels.length === 0) return;

    ctx.save();
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 1;

    for (const pixel of this.pixels) {
      if (this.elapsed >= pixel.eraseAt) continue;
      ctx.fillRect(pixel.x, pixel.y - cameraY, pixel.size, pixel.size);
    }

    ctx.restore();
  }

  isFinished(): boolean {
    return this.elapsed >= this.totalDuration;
  }

  private _createPixels(
    rect: { x: number; y: number; width: number; height: number },
    pixelSize: number
  ): HeartDisintegratePixel[] {
    const pixels: HeartDisintegratePixel[] = [];
    const baseSize = Math.max(1, pixelSize);

    for (let row = 0; row < HEART_PATTERN.length; row += 1) {
      const patternRow = HEART_PATTERN[row];
      for (let col = 0; col < patternRow.length; col += 1) {
        if (patternRow[col] !== 1) continue;
        pixels.push({
          x: rect.x + col * baseSize,
          y: rect.y + row * baseSize,
          size: baseSize,
          eraseAt: 0
        });
      }
    }

    if (pixels.length === 0) return pixels;

    const indices = pixels.map((_, index) => index);
    for (let i = indices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    for (let order = 0; order < indices.length; order += 1) {
      const pixelIndex = indices[order];
      pixels[pixelIndex].eraseAt = (order + 1) * PIXEL_ERASE_INTERVAL;
    }

    return pixels;
  }
}

export interface HeartEffectSystemOptions {
  color?: string;
}

export class HeartEffectSystem {
  private effects: HeartDisintegrateEffect[] = [];
  private color: string;
  private cleanups: Array<() => void> = [];

  constructor(options: HeartEffectSystemOptions = {}) {
    this.color = options.color ?? '#ff5b6e';
    this._bindEvents();
  }

  update(dt: number): void {
    for (const effect of this.effects) {
      effect.update(dt);
    }
    this.effects = this.effects.filter((effect) => !effect.isFinished());
  }

  draw(ctx: CanvasRenderingContext2D, cameraY: number): void {
    for (const effect of this.effects) {
      effect.draw(ctx, cameraY);
    }
  }

  spawnDisintegrateForHeart(heart: HeartPickup): void {
    const info = heart.getRenderInfo();
    this.effects.push(
      new HeartDisintegrateEffect({
        rect: info.rect,
        pixelSize: info.pixelSize,
        color: this.color
      })
    );
  }

  dispose(): void {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
    this.effects = [];
  }

  private _bindEvents(): void {
    const removeKilledListener = onHeartPickupKilled(
      (payload: HeartPickupEventPayload) => {
        this.spawnDisintegrateForHeart(payload.heart);
      }
    );
    this.cleanups.push(removeKilledListener);
  }
}
