import {
  MIN_PLATFORM_SPEED,
  MAX_PLATFORM_SPEED,
  MAX_PLATFORMS,
  SPRITE_SIZE
} from './constants.js';
import { canvasWidth, cameraY } from './globals.js';
import { Platform } from './platforms.js';
import { clamp } from './utils.js';

const RAD_TO_DEG = 180 / Math.PI;
const MOVEMENT_THRESHOLD = 14;
const SPAWN_THRESHOLD = 12;
const MAX_ROTATION_DEG_PER_SEC = 720;
const MIN_ROTATION_DEGREES = 8;

export class JoystickController {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.center = { x: 0, y: 0 };
    this.current = { x: 0, y: 0 };
    this.mode = null;
    this.movementActive = false;
    this.allowSpawn = false;
    this.startedOnGround = true;
    this.startTime = 0;
    this.startScreenY = 0;
    this.lastAngle = null;
    this.accumulatedAngle = 0;
    this.outerRadius = 32;
    this.innerRadius = 10;
  }

  start(point, sprite, options = {}) {
    this.reset();
    this.active = true;
    this.center = { x: point.x, y: point.y };
    this.current = { x: point.x, y: point.y };
    this.startTime = point.time || Date.now();
    this.startScreenY = options.startScreenY ?? point.y;
    this.startedOnGround = sprite.onGround;
    this.allowSpawn = Boolean(options.allowSpawn) && !this.startedOnGround;
    this.mode = null;
    this.movementActive = false;
    this.lastAngle = null;
    this.accumulatedAngle = 0;
  }

  update(point, sprite) {
    if (!this.active) return;
    this.current = { x: point.x, y: point.y };

    if (!sprite.onGround && this.allowSpawn) {
      this._updateSpawn();
      return;
    }

    if (sprite.onGround) {
      this._updateMovement(sprite);
    }
  }

  end(point, sprite) {
    if (!this.active) return { handled: false, spawned: false };

    let handled = false;
    let spawned = false;

    if (this.mode === 'movement' && this.movementActive) {
      sprite.releaseMovement();
      handled = true;
    } else if (this.mode === 'spawn' && this.allowSpawn) {
      const result = this._spawnPlatform(point.time || Date.now());
      spawned = result;
      handled = true;
    }

    this.reset();
    return { handled, spawned };
  }

  cancel() {
    this.reset();
  }

  reset() {
    this.active = false;
    this.mode = null;
    this.movementActive = false;
    this.allowSpawn = false;
    this.startedOnGround = true;
    this.startTime = 0;
    this.startScreenY = 0;
    this.lastAngle = null;
    this.accumulatedAngle = 0;
  }

  draw(ctx) {
    if (!this.active) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.center.x, this.center.y, this.outerRadius, 0, Math.PI * 2);
    ctx.stroke();

    const dx = this.current.x - this.center.x;
    const dy = this.current.y - this.center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = dist > 0 ? Math.atan2(dy, dx) : 0;
    const clampedDist = Math.min(dist, this.outerRadius - this.innerRadius);
    const knobX = this.center.x + Math.cos(angle) * clampedDist;
    const knobY = this.center.y + Math.sin(angle) * clampedDist;

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(this.center.x, this.center.y, this.outerRadius - 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(knobX, knobY, this.innerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _updateMovement(sprite) {
    const dx = this.current.x - this.center.x;
    const dy = this.current.y - this.center.y;
    const distance = Math.hypot(dx, dy);

    if (distance < MOVEMENT_THRESHOLD) return;

    const direction = {
      x: dx / distance,
      y: dy / distance
    };

    if (!this.movementActive) {
      sprite.charging = false;
      sprite.startMovementCharging(direction);
      this.mode = 'movement';
      this.movementActive = true;
    } else {
      sprite.updateMovementCharging(direction);
    }
  }

  _updateSpawn() {
    const dx = this.current.x - this.center.x;
    const dy = this.current.y - this.center.y;
    const distance = Math.hypot(dx, dy);
    if (distance < SPAWN_THRESHOLD) return;

    const angle = Math.atan2(dy, dx);
    if (this.mode !== 'spawn') {
      this.mode = 'spawn';
      this.lastAngle = angle;
      this.accumulatedAngle = 0;
      return;
    }

    let delta = angle - this.lastAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;

    this.accumulatedAngle += delta;
    this.lastAngle = angle;
  }

  _spawnPlatform(endTime) {
    const rotationDegrees = Math.min(360, Math.abs(this.accumulatedAngle) * RAD_TO_DEG);
    if (rotationDegrees < MIN_ROTATION_DEGREES) return false;

    const activeMovers = this.game.platforms.filter(p => p && p.active !== false && p.direction !== 0).length;
    if (activeMovers >= MAX_PLATFORMS) return false;

    const baseWidth = this._getReferencePlatformWidth();
    const maxLength = Math.max(SPRITE_SIZE * 2, baseWidth * 0.9);
    const ratio = rotationDegrees / 360;
    const width = clamp(maxLength * ratio, SPRITE_SIZE * 2, maxLength);

    const durationMs = Math.max(16, (endTime || Date.now()) - this.startTime);
    const angularSpeed = rotationDegrees / (durationMs / 1000);
    const speedRatio = clamp(angularSpeed / MAX_ROTATION_DEG_PER_SEC, 0, 1);
    const speed = MIN_PLATFORM_SPEED + (MAX_PLATFORM_SPEED - MIN_PLATFORM_SPEED) * speedRatio;

    const direction = this.accumulatedAngle >= 0 ? 1 : -1;
    const worldY = this.startScreenY + cameraY;
    const startX = direction > 0 ? -width : canvasWidth;

    const platform = new Platform(startX, worldY, width, speed, direction);
    this.game.platforms.push(platform);
    return true;
  }

  _getReferencePlatformWidth() {
    const sprite = this.game.sprite;
    if (!sprite) return canvasWidth * 0.6;

    let bestWidth = canvasWidth * 0.6;
    let bestDelta = Infinity;
    for (const platform of this.game.platforms) {
      if (!(platform instanceof Platform)) continue;
      if (!platform.active) continue;
      const moving = Math.abs(platform.speed) > 0 && Math.abs(platform.direction || 0) > 0;
      if (moving) continue;

      const delta = platform.y - sprite.y;
      if (delta >= 0 && delta < bestDelta) {
        bestDelta = delta;
        bestWidth = platform.width;
      }
    }

    return Math.max(bestWidth, SPRITE_SIZE * 2);
  }
}
