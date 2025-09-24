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

  constructor({ gate, rect, orientation, avoidPosition }: {
    gate: GateLike;
    rect: EnemyRect;
    orientation: EnemyOrientation;
    avoidPosition?: { x: number; y: number };
  }) {
    this.gate = gate;
    this.rect = rect;
    this.orientation = orientation;

    this.radius = ENEMY_RADIUS;
    this.speed = randomSpeed();
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
      
      // Smart positioning: spawn away from sprite if position is provided
      if (avoidPosition && avoidPosition.x >= minX && avoidPosition.x <= maxX) {
        // Sprite is within this patrol range
        const midPoint = (this.min + this.max) / 2;
        const safeDistance = (this.max - this.min) * 0.4; // 40% of patrol range
        
        if (avoidPosition.x < midPoint) {
          // Sprite is on the left side, spawn enemy on the right
          this.position = Math.min(this.max, avoidPosition.x + safeDistance);
          this.direction = 1; // Start moving right (away from sprite initially)
        } else {
          // Sprite is on the right side, spawn enemy on the left
          this.position = Math.max(this.min, avoidPosition.x - safeDistance);
          this.direction = -1; // Start moving left (away from sprite initially)
        }
      } else {
        // Sprite is not in this patrol range, spawn at edges moving inward
        const midPoint = (this.min + this.max) / 2;
        if (avoidPosition && avoidPosition.x < midPoint) {
          // Sprite is to the left, spawn at right edge moving left
          this.position = this.max;
          this.direction = -1;
        } else if (avoidPosition && avoidPosition.x > midPoint) {
          // Sprite is to the right, spawn at left edge moving right
          this.position = this.min;
          this.direction = 1;
        } else {
          // No sprite position or sprite is centered, use random edge
          if (Math.random() > 0.5) {
            this.position = this.max;
            this.direction = -1;
          } else {
            this.position = this.min;
            this.direction = 1;
          }
        }
      }
      
      this.baseY = rect.y - this.radius + 4;
      this.baseX = null;
    } else {
      // Vertical orientation
      const minY = rect.y + this.radius;
      const maxY = rect.y + rect.h - this.radius;
      this.min = Math.min(minY, maxY);
      this.max = Math.max(minY, maxY);
      
      // For vertical enemies, spawn at edges
      if (Math.random() > 0.5) {
        this.position = this.max;
        this.direction = -1;
      } else {
        this.position = this.min;
        this.direction = 1;
      }
      
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
    const screenY = this.y - cameraYValue;
    if (screenY < -50 || screenY > canvasHeight + 120) return;

    ctx.save();
    ctx.translate(this.x - cameraXValue, screenY);

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

/**
 * Distributes enemies evenly across rectangles based on their capacity.
 * Uses a round-robin approach to ensure fair distribution.
 * 
 * Examples:
 * - 6 enemies, capacities [5, 5, 5] → [2, 2, 2] (even distribution)
 * - 5 enemies, capacities [5, 5, 5] → [2, 2, 1] (round-robin remainder)
 * - 4 enemies, capacities [2, 3, 3] → [2, 1, 1] (respects capacity limits)
 * - 8 enemies, capacities [2, 2, 2] → [2, 2, 2] (limited by total capacity)
 * 
 * @param totalEnemies - Total number of enemies to distribute
 * @param capacities - Array of maximum capacity for each rectangle
 * @returns Array of enemy counts for each rectangle
 */
function calculateEvenDistribution(totalEnemies: number, capacities: number[]): number[] {
  if (capacities.length === 0 || totalEnemies === 0) {
    return [];
  }

  // Initialize distribution array
  const distribution = new Array(capacities.length).fill(0);
  
  // Filter out rectangles with zero capacity
  const validIndices = capacities
    .map((capacity, index) => ({ capacity, index }))
    .filter(({ capacity }) => capacity > 0)
    .map(({ index }) => index);

  if (validIndices.length === 0) {
    return distribution;
  }

  let remainingEnemies = totalEnemies;
  
  // Use round-robin distribution to ensure even spread
  while (remainingEnemies > 0) {
    let distributed = false;
    
    for (const index of validIndices) {
      if (remainingEnemies <= 0) break;
      
      // Only add an enemy if this rectangle hasn't reached its capacity
      if (distribution[index] < capacities[index]) {
        distribution[index]++;
        remainingEnemies--;
        distributed = true;
      }
    }
    
    // If no rectangles can accept more enemies, break to avoid infinite loop
    if (!distributed) break;
  }

  return distribution;
}

export function spawnEnemiesForGate(
  gate: GateLike,
  { count, register = true, avoidPosition }: { count: number; register?: boolean; avoidPosition?: { x: number; y: number } }
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

  const spawned: EnemyActor[] = [];

  // Calculate how many enemies can fit on each candidate rectangle
  const candidateCapacities = candidates.map(({ rect, orientation }) => {
    if (orientation === 'horizontal') {
      // For horizontal rectangles, calculate how many enemies can fit based on width
      return Math.floor(rect.w / (ENEMY_SIZE * 1.2));
    } else {
      // For vertical rectangles, calculate how many enemies can fit based on height
      return Math.floor(rect.h / (ENEMY_SIZE * 1.2));
    }
  });

  const totalCapacity = candidateCapacities.reduce((sum, capacity) => sum + capacity, 0);
  const maxSpawns = Math.min(count, totalCapacity);

  // Calculate even distribution of enemies across rectangles
  const distribution = calculateEvenDistribution(maxSpawns, candidateCapacities);

  // Spawn enemies according to the calculated distribution
  for (let i = 0; i < candidates.length && i < distribution.length; i++) {
    const candidate = candidates[i];
    const enemiesToSpawn = distribution[i];

    for (let j = 0; j < enemiesToSpawn; j++) {
      const enemy = new Enemy({
        gate,
        rect: candidate.rect,
        orientation: candidate.orientation,
        avoidPosition
      });
      spawned.push(enemy);
      if (register) enemies.push(enemy);
    }
  }

  return spawned;
}

export function updateEnemies(game: GameState, dt: number) {
  for (const enemy of enemies) enemy.update(dt, game);
}

export function drawEnemies(ctx: CanvasRenderingContext2D, cameraXValue: number, cameraYValue: number) {
  for (const enemy of enemies) enemy.draw(ctx, cameraXValue, cameraYValue);
}

export function pruneInactiveEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (!enemies[i] || enemies[i].active === false) enemies.splice(i, 1);
  }
}
