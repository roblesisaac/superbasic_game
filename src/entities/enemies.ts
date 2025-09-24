import { SPRITE_SIZE, RIDE_SPEED_THRESHOLD } from '../config/constants.js';
import { canvasHeight, cameraY, type GameState } from '../core/globals.js';

type EnemyOrientation = 'horizontal' | 'vertical';

interface EnemyRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type GateLike = {
  getRects?: () => EnemyRect[];
};

const ENEMY_SIZE = 22;
const ENEMY_RADIUS = ENEMY_SIZE / 2;
const ENEMY_SPEED_MIN = 70;
const ENEMY_SPEED_MAX = 140;
const DAMAGE_COOLDOWN = 0.6;
const OFFSCREEN_BUFFER = 220;
const ENEMY_STUN_DURATION = 10;
const STUN_BLINK_INTERVAL_SLOW = 0.6;
const STUN_BLINK_INTERVAL_FAST = 0.18;

function randomSpeed() {
  return ENEMY_SPEED_MIN + Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN);
}

export const enemies: Enemy[] = [];

export function resetEnemies() {
  enemies.length = 0;
}

class Enemy {
  gate: GateLike;
  rect: EnemyRect;
  orientation: EnemyOrientation;
  radius: number;
  speed: number;
  direction: number;
  damageCooldown: number;
  active: boolean;
  stunned: boolean;
  stunTimer: number;
  stunBlinkTimer: number;
  stunVisible: boolean;
  min: number;
  max: number;
  position: number;
  baseY: number | null;
  baseX: number | null;
  x: number;
  y: number;

  constructor({ gate, rect, orientation }: {
    gate: GateLike;
    rect: EnemyRect;
    orientation: EnemyOrientation;
  }) {
    this.gate = gate;
    this.rect = rect;
    this.orientation = orientation;

    this.radius = ENEMY_RADIUS;
    this.speed = randomSpeed();
    this.direction = Math.random() > 0.5 ? 1 : -1;
    this.damageCooldown = 0;
    this.active = true;
    this.stunned = false;
    this.stunTimer = 0;
    this.stunBlinkTimer = 0;
    this.stunVisible = true;

    if (orientation === 'horizontal') {
      const minX = rect.x + this.radius;
      const maxX = rect.x + rect.w - this.radius;
      this.min = Math.min(minX, maxX);
      this.max = Math.max(minX, maxX);
      this.position = this.min + Math.random() * (this.max - this.min);
      this.baseY = rect.y - this.radius + 4;
      this.baseX = null;
    } else {
      const minY = rect.y + this.radius;
      const maxY = rect.y + rect.h - this.radius;
      this.min = Math.min(minY, maxY);
      this.max = Math.max(minY, maxY);
      this.position = this.min + Math.random() * (this.max - this.min);
      this.baseX = rect.x + rect.w / 2;
      this.baseY = null;
    }

    this.x = orientation === 'horizontal' ? this.position : this.baseX;
    this.y = orientation === 'horizontal' ? this.baseY : this.position;
  }

  update(dt: number, game: GameState) {
    if (!this.active) return;

    if (this.damageCooldown > 0) {
      this.damageCooldown = Math.max(0, this.damageCooldown - dt);
    }

    this._updateStunState(dt);

    if (!this.stunned) {
      if (this.orientation === 'horizontal') {
        this.position += this.direction * this.speed * dt;
        if (this.position >= this.max) {
          this.position = this.max;
          this.direction = -1;
        } else if (this.position <= this.min) {
          this.position = this.min;
          this.direction = 1;
        }
      } else {
        this.position += this.direction * this.speed * dt;
        if (this.position >= this.max) {
          this.position = this.max;
          this.direction = -1;
        } else if (this.position <= this.min) {
          this.position = this.min;
          this.direction = 1;
        }
      }
    }

    if (this.orientation === 'horizontal') {
      this.x = this.position;
      this.y = this.baseY;
    } else {
      this.x = this.baseX;
      this.y = this.position;
    }

    this._checkRideCollisions(game?.rides);

    if (this.y - this.radius > cameraY + canvasHeight + OFFSCREEN_BUFFER) {
      return;
    }

    const sprite = game?.sprite;
    if (!sprite) return;

    const spriteRadius = SPRITE_SIZE / 2;
    const dx = this.x - sprite.x;
    const dy = this.y - sprite.y;
    const combined = this.radius + spriteRadius;

    if ((dx * dx + dy * dy) > combined * combined) return;

    const prevVy = sprite.prevVy ?? sprite.vy;
    const prevY = sprite.prevY ?? sprite.y;
    const spritePrevBottom = prevY + spriteRadius;
    const spriteCurrBottom = sprite.y + spriteRadius;
    const enemyTop = this.y - this.radius;

    const isStomp = prevVy > 0 && spritePrevBottom <= enemyTop && spriteCurrBottom >= enemyTop;

    if (isStomp) {
      this.active = false;
      const bounceSpeed = Math.max(420, Math.abs(prevVy) * 0.55);
      sprite.vy = -bounceSpeed;
      sprite.onGround = false;
      sprite.onPlatform = false;
      sprite.impactSquash = Math.max(sprite.impactSquash, 1.0);
      return;
    }

    if (this.stunned) return;

    if (sprite.isInvulnerable()) return;

    if (this.damageCooldown <= 0) {
      sprite.takeDamage();
      this.damageCooldown = DAMAGE_COOLDOWN;
    }
  }

  draw(ctx: CanvasRenderingContext2D, cameraXValue: number, cameraYValue: number) {
    if (!this.active) return;
    const screenX = this.x - cameraXValue;
    const screenY = this.y - cameraYValue;
    if (screenY < -50 || screenY > canvasHeight + 120) return;

    ctx.save();
    ctx.translate(screenX, screenY);

    // While stunned, alternate between yellow and red instead of hiding
    ctx.fillStyle = this.stunned ? (this.stunVisible ? '#ffa94d' : '#ff4d4d') : '#ff4d4d';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-this.radius * 0.3, -this.radius * 0.2, this.radius * 0.18, 0, Math.PI * 2);
    ctx.arc(this.radius * 0.3, -this.radius * 0.2, this.radius * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-this.radius * 0.3, -this.radius * 0.25, this.radius * 0.08, 0, Math.PI * 2);
    ctx.arc(this.radius * 0.3, -this.radius * 0.25, this.radius * 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  stun() {
    this.stunned = true;
    this.stunTimer = ENEMY_STUN_DURATION;
    this.stunVisible = true;
    this.stunBlinkTimer = this._getBlinkInterval();
  }

  _updateStunState(dt: number) {
    if (!this.stunned) return;

    this.stunTimer = Math.max(0, this.stunTimer - dt);

    this.stunBlinkTimer -= dt;
    if (this.stunBlinkTimer <= 0) {
      this.stunVisible = !this.stunVisible;
      this.stunBlinkTimer = this._getBlinkInterval();
    }

    if (this.stunTimer <= 0) {
      this.stunned = false;
      this.stunVisible = true;
      this.stunBlinkTimer = 0;
    }
  }

  _getBlinkInterval() {
    if (!this.stunned) return STUN_BLINK_INTERVAL_SLOW;
    const ratio = Math.max(0, Math.min(1, this.stunTimer / ENEMY_STUN_DURATION));
    return STUN_BLINK_INTERVAL_FAST + (STUN_BLINK_INTERVAL_SLOW - STUN_BLINK_INTERVAL_FAST) * ratio;
  }

  _checkRideCollisions(rides: any[]) {
    if (!Array.isArray(rides) || rides.length === 0) return;

    for (const ride of rides) {
      if (!ride || typeof ride.getRect !== 'function') continue;
      if (ride.active === false || ride.floating) continue;

      const direction = typeof ride.direction === 'number' ? ride.direction : 0;
      const speed = typeof ride.speed === 'number' ? ride.speed : 0;
      const magnitude = Math.abs(direction * speed);
      if (magnitude < RIDE_SPEED_THRESHOLD) continue;

      const rect = ride.getRect();
      if (!rect) continue;

      const closestX = Math.max(rect.x, Math.min(this.x, rect.x + rect.w));
      const closestY = Math.max(rect.y, Math.min(this.y, rect.y + rect.h));
      const dx = this.x - closestX;
      const dy = this.y - closestY;
      if (dx * dx + dy * dy <= this.radius * this.radius) {
        this.stun();
        return;
      }
    }
  }
}

export type EnemyActor = InstanceType<typeof Enemy>;

function segmentOrientation(rect: EnemyRect): EnemyOrientation {
  return rect.w >= rect.h ? 'horizontal' : 'vertical';
}

export function spawnEnemiesForGate(
  gate: GateLike,
  { count, register = true }: { count: number; register?: boolean }
): EnemyActor[] {
  if (!gate || typeof gate.getRects !== 'function') return [];

  const rects = gate.getRects();
  if (!Array.isArray(rects) || rects.length === 0) return [];

  const candidates = rects
    .map(rect => ({ rect, orientation: segmentOrientation(rect) }))
    .filter(({ rect, orientation }) => {
      if (orientation === 'horizontal') {
        return rect.w >= ENEMY_SIZE * 1.2;
      }
      return rect.h >= ENEMY_SIZE * 1.2;
    });

  if (candidates.length === 0 || !count) return [];

  const maxSpawns = Math.min(count, candidates.length);
  const spawned: EnemyActor[] = [];
  const used = new Set<number>();

  while (spawned.length < maxSpawns) {
    const pool = candidates.filter((candidate, index) => !used.has(index));
    if (pool.length === 0) break;

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    if (!chosen) break;

    const index = candidates.indexOf(chosen);
    if (index !== -1) used.add(index);

    const enemy = new Enemy({
      gate,
      rect: chosen.rect,
      orientation: chosen.orientation
    });
    spawned.push(enemy);
    if (register) enemies.push(enemy);
  }

  return spawned;
}

export function updateEnemies(game: GameState, dt: number) {
  for (const enemy of enemies) enemy.update(dt, game);
}

export function drawEnemies(
  ctx: CanvasRenderingContext2D,
  cameraXValue: number,
  cameraYValue: number
) {
  for (const enemy of enemies) enemy.draw(ctx, cameraXValue, cameraYValue);
}

export function pruneInactiveEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (!enemies[i] || enemies[i].active === false) enemies.splice(i, 1);
  }
}
