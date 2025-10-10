import { HEART_PATTERN } from '../../gui/drawPixelatedHeart.js';
import {
  onHeartPickupKilled,
  type HeartPickup,
  type HeartPickupEventPayload
} from '../../game_objects/heartPickup.js';

interface HeartDisintegrateShard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  lifetime: number;
  size: number;
  baseSize: number;
  intensity: number;
}

interface HeartDisintegrateEffectOptions {
  rect: { x: number; y: number; width: number; height: number };
  pixelSize: number;
  color: string;
}

const GRAVITY = 420;
const HORIZONTAL_SPEED = 70;
const VERTICAL_SPEED = 110;

class HeartDisintegrateEffect {
  private shards: HeartDisintegrateShard[];
  private color: string;

  constructor({ rect, pixelSize, color }: HeartDisintegrateEffectOptions) {
    this.color = color;
    this.shards = this._createShards(rect, pixelSize);
  }

  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (const shard of this.shards) {
      if (shard.life <= 0) continue;
      shard.life -= dt;
      if (shard.life <= 0) {
        shard.life = 0;
        continue;
      }
      shard.vy += GRAVITY * dt;
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D, cameraY: number): void {
    ctx.save();
    ctx.fillStyle = this.color;

    for (const shard of this.shards) {
      if (shard.life <= 0) continue;
      const alpha = Math.max(0, shard.life / shard.lifetime) * shard.intensity;
      if (alpha <= 0.01) continue;

      ctx.globalAlpha = alpha;

      const shrink = 0.4 + 0.6 * (shard.life / shard.lifetime);
      const size = Math.max(0.5, shard.baseSize * shrink);
      ctx.fillRect(
        shard.x - size / 2,
        shard.y - cameraY - size / 2,
        size,
        size
      );
    }

    ctx.restore();
  }

  isFinished(): boolean {
    return this.shards.every((shard) => shard.life <= 0);
  }

  private _createShards(
    rect: { x: number; y: number; width: number; height: number },
    pixelSize: number
  ): HeartDisintegrateShard[] {
    const shards: HeartDisintegrateShard[] = [];
    const baseSize = Math.max(1, pixelSize);

    for (let row = 0; row < HEART_PATTERN.length; row += 1) {
      const patternRow = HEART_PATTERN[row];
      for (let col = 0; col < patternRow.length; col += 1) {
        if (patternRow[col] !== 1) continue;
        const cellX = rect.x + col * baseSize + baseSize / 2;
        const cellY = rect.y + row * baseSize + baseSize / 2;
        const lifetime = 0.35 + Math.random() * 0.35;
        const vx = (Math.random() - 0.5) * HORIZONTAL_SPEED;
        const vy = -Math.random() * VERTICAL_SPEED - 40;
        const intensity = 0.6 + Math.random() * 0.4;

        shards.push({
          x: cellX,
          y: cellY,
          vx,
          vy,
          life: lifetime,
          lifetime,
          baseSize: baseSize * (0.75 + Math.random() * 0.5),
          size: baseSize,
          intensity
        });
      }
    }

    return shards;
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
