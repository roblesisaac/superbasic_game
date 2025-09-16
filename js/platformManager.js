import {
  MIN_PLATFORM_SPEED,
  MAX_PLATFORM_SPEED,
  MAX_PLATFORMS,
  PLATFORM_MIN_WIDTH,
  PLATFORM_MAX_WIDTH
} from './constants.js';
import { canvasWidth, cameraY } from './globals.js';
import { clamp } from './utils.js';
import { Platform } from './platforms.js';

/**
 * Coordinates creation and bookkeeping for dynamic platforms.
 */
export class PlatformManager {
  constructor(game) {
    this.game = game;
  }

  /**
   * Return the number of active moving platforms.
   */
  getActiveMovingCount() {
    if (!this.game.platforms) return 0;
    return this.game.platforms.filter(p => p && p.direction !== 0 && p.active !== false).length;
  }

  /**
   * Create a moving platform from a user gesture if the game state allows it.
   * @param {number} dx - Horizontal distance in screen space.
   * @param {number} totalTimeMs - Gesture duration in milliseconds.
   * @param {number} screenY - Y position relative to the canvas.
   */
  createPlatformFromGesture(dx, totalTimeMs, screenY) {
    const sprite = this.game.sprite;
    if (!sprite || sprite.onGround) return;

    if (this.getActiveMovingCount() >= MAX_PLATFORMS) return;

    const duration = Math.max(1, Math.abs(totalTimeMs));
    const dir = dx >= 0 ? 1 : -1;
    const speedRaw = Math.abs(dx) / (duration / 1000);
    const speed = clamp(speedRaw, MIN_PLATFORM_SPEED, MAX_PLATFORM_SPEED);

    const width = clamp(
      PLATFORM_MIN_WIDTH + (PLATFORM_MAX_WIDTH - PLATFORM_MIN_WIDTH) * (duration / 700),
      PLATFORM_MIN_WIDTH,
      PLATFORM_MAX_WIDTH
    );

    const worldY = screenY + cameraY;
    const x = dir > 0 ? -width : canvasWidth;
    const platform = new Platform(x, worldY, width, speed, dir);
    this.game.platforms.push(platform);
  }
}
