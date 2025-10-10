import { HEART_PATTERN } from '../../gui/drawPixelatedHeart.js';
import {
  onHeartPickupKilled,
  type HeartPickup,
  type HeartPickupEventPayload
} from '../../game_objects/heartPickup.js';
import {
  DisintegrateEffect,
  buildPixelsFromPattern
} from './disintegrate_effect.js';

export interface HeartEffectSystemOptions {
  color?: string;
}

export class HeartEffectSystem {
  private effects: DisintegrateEffect[] = [];
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
    const pixels = buildPixelsFromPattern(info.rect, info.pixelSize, HEART_PATTERN);
    this.effects.push(
      new DisintegrateEffect({
        pixels,
        color: this.color,
        mode: 'disintegrate'
      }),
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
