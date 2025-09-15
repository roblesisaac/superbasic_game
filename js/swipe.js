import {
  MIN_PLATFORM_SPEED,
  MAX_PLATFORM_SPEED,
  MAX_PLATFORMS,
  PLATFORM_MIN_WIDTH,
  PLATFORM_MAX_WIDTH
} from './constants.js';
import { canvasWidth, cameraY } from './globals.js';
import { Platform } from './platforms.js';
import { clamp } from './utils.js';

export class SwipeController {
  constructor(game) {
    this.game = game;
  }

  spawnFromGesture(dx, totalTimeMs, screenY) {
    if (this.game.sprite.onGround) return;

    const activeMovers = this.game.platforms.filter(p => p && p.active !== false && p.direction !== 0).length;
    if (activeMovers >= MAX_PLATFORMS) return;

    const dir = dx >= 0 ? 1 : -1;
    const duration = Math.max(1, totalTimeMs);
    const speedRaw = Math.abs(dx) / (duration / 1000);
    const speed = clamp(speedRaw, MIN_PLATFORM_SPEED, MAX_PLATFORM_SPEED);

    const widthFactor = clamp(duration / 700, 0, 1);
    const width = clamp(
      PLATFORM_MIN_WIDTH + (PLATFORM_MAX_WIDTH - PLATFORM_MIN_WIDTH) * widthFactor,
      PLATFORM_MIN_WIDTH,
      PLATFORM_MAX_WIDTH
    );

    const worldY = screenY + cameraY;
    const startX = dir > 0 ? -width : canvasWidth;

    const platform = new Platform(startX, worldY, width, speed, dir);
    this.game.platforms.push(platform);
  }
}
