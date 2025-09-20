import {
  RIDE_THICKNESS,
  RIDE_SPEED_THRESHOLD,
  RIDE_FLOAT_TIME,
  MIN_RIDE_SPEED,
  MAX_RIDE_SPEED,
  RIDE_MIN_WIDTH,
  RIDE_MAX_WIDTH,
  RIDE_WEIGHT_SHIFT_MIN,
  RIDE_WEIGHT_SHIFT_MAX,
  RIDE_WEIGHT_RETURN_DURATION
} from './constants.js';
import { clamp, rectsIntersect } from './utils.js';

export class Ride {
  constructor({ x, y, width, speed, direction, canvasWidth }) {
    this.x = x;
    this.baseY = y;
    this.y = y;
    this.width = width;
    this.speed = speed;
    this.direction = direction;
    this.canvasWidth = canvasWidth;

    this.active = true;
    this.floating = false;
    this.floatTime = 0;
    this.originalSpeed = speed;

    this.weightOffset = 0;
    this.weightDrop = 0;
    this.weightReturnTime = 0;
    this.weightReturning = false;
    this._applyWeightOffset();
  }

  update(dt) {
    if (!this.active) return;

    this._updateWeightShift(dt);

    if (this.floating) {
      this.floatTime -= dt;
      if (this.floatTime <= 0) this.active = false;
      return;
    }

    this.x += this.speed * this.direction * dt;

    if (this.direction > 0 && this.x > this.canvasWidth + this.width) this.active = false;
    if (this.direction < 0 && this.x + this.width < 0) this.active = false;
  }

  startFloating() {
    this.floating = true;
    this.floatTime = RIDE_FLOAT_TIME;
    this.speed = 0;
    this.direction = 0;
  }

  draw(ctx, cameraY) {
    if (!this.active) return;

    let color = this.originalSpeed >= RIDE_SPEED_THRESHOLD ? '#ff6b35' : '#4ecdc4';
    if (this.floating) color = '#9b59b6';

    ctx.fillStyle = color;
    ctx.fillRect(this.x, this.y - RIDE_THICKNESS / 2 - cameraY, this.width, RIDE_THICKNESS);
  }

  getRect() {
    return {
      x: this.x,
      y: this.y - RIDE_THICKNESS / 2,
      w: this.width,
      h: RIDE_THICKNESS
    };
  }

  applyWeightShift(impactVelocity = 0) {
    const minDrop = RIDE_WEIGHT_SHIFT_MIN;
    const maxDrop = RIDE_WEIGHT_SHIFT_MAX;
    const span = Math.max(0, maxDrop - minDrop);
    
    // Base drop amount
    let drop = span > 0 ? minDrop + Math.random() * span : minDrop;
    
    // Scale drop based on impact velocity for more realistic physics
    // Higher velocity = more dramatic weight shift
    if (impactVelocity > 0) {
      const velocityFactor = Math.min(1.5, impactVelocity / 800); // Cap at 1.5x
      drop *= (1 + velocityFactor * 0.4); // Up to 40% more drop for hard impacts
    }
    
    // If already dropping, accumulate the impact
    const newDrop = Math.max(drop, this.weightOffset, this.weightDrop);
    this.weightDrop = newDrop;
    this.weightOffset = newDrop;
    this.weightReturnTime = 0;
    this.weightReturning = true;
    this._applyWeightOffset();
  }

  _updateWeightShift(dt) {
    if (!Number.isFinite(dt)) {
      this._applyWeightOffset();
      return;
    }

    if (this.weightReturning) {
      const duration = Math.max(0.001, RIDE_WEIGHT_RETURN_DURATION);
      this.weightReturnTime += dt;

      const t = clamp(this.weightReturnTime / duration, 0, 1);
      
      // Use a more natural spring-like easing for hoverboard feel
      // Creates a slight overshoot and settle effect
      const springEase = this._springEase(t);
      this.weightOffset = this.weightDrop * (1 - springEase);

      if (t >= 1) {
        this.weightOffset = 0;
        this.weightDrop = 0;
        this.weightReturnTime = 0;
        this.weightReturning = false;
      }
    }

    this._applyWeightOffset();
  }

  _springEase(t) {
    // Spring-like easing with slight overshoot for natural hoverboard feel
    // Uses a combination of cubic and sine functions for smooth, bouncy motion
    const c1 = 1.70158; // Overshoot factor
    const c2 = c1 * 1.525;
    
    if (t < 0.5) {
      return (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2;
    } else {
      return (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }
  }

  _applyWeightOffset() {
    this.y = this.baseY + this.weightOffset;
  }
}

export function createRideFromInput({ distance, durationMs, screenY, cameraY, canvasWidth }) {
  const normalizedDuration = Math.max(1, durationMs);
  const direction = distance >= 0 ? 1 : -1;
  const distanceMagnitude = Math.abs(distance);

  const speedRaw = distanceMagnitude / (normalizedDuration / 1000);
  const speed = clamp(speedRaw, MIN_RIDE_SPEED, MAX_RIDE_SPEED);

  const width = clamp(
    RIDE_MIN_WIDTH + (RIDE_MAX_WIDTH - RIDE_MIN_WIDTH) * (normalizedDuration / 700),
    RIDE_MIN_WIDTH,
    RIDE_MAX_WIDTH
  );

  const worldY = screenY + cameraY;
  const startX = direction > 0 ? -width : canvasWidth;

  return new Ride({
    x: startX,
    y: worldY,
    width,
    speed,
    direction,
    canvasWidth
  });
}

export function countActiveMovingRides(rides) {
  return rides.filter(ride => ride?.direction !== 0 && ride.active !== false).length;
}

export function updateRides(rides, dt) {
  for (const ride of rides) ride.update(dt);
}

export function pruneInactiveRides(rides) {
  for (let i = rides.length - 1; i >= 0; i--) {
    if (!rides[i] || rides[i].active === false) rides.splice(i, 1);
  }
}

export function drawRides(ctx, rides, cameraY) {
  for (const ride of rides) ride.draw(ctx, cameraY);
}

export function mergeCollidingRides(rides, canvasWidth) {
  for (let i = 0; i < rides.length; i++) {
    const first = rides[i];
    if (!first || !first.active || first.floating) continue;

    const firstRect = first.getRect();

    for (let j = i + 1; j < rides.length; j++) {
      const second = rides[j];
      if (!second || !second.active || second.floating) continue;

      const secondRect = second.getRect();
      if (!rectsIntersect(firstRect, secondRect)) continue;

      const ra = firstRect;
      const rb = secondRect;
      const left = Math.max(ra.x, rb.x);
      const right = Math.min(ra.x + ra.w, rb.x + rb.w);
      const top = Math.max(ra.y, rb.y);
      const bottom = Math.min(ra.y + ra.h, rb.y + rb.h);

      const cx = left + (right - left) / 2;
      const cy = top + (bottom - top) / 2;

      const newWidth = 0.5 * (first.width + second.width);
      const newX = cx - newWidth / 2;
      const newY = cy + RIDE_THICKNESS / 2;

      const mergedRide = new Ride({
        x: newX,
        y: newY,
        width: newWidth,
        speed: 0,
        direction: 0,
        canvasWidth
      });
      mergedRide.startFloating();

      rides.splice(j, 1);
      rides.splice(i, 1);
      rides.push(mergedRide);
      return true;
    }
  }

  return false;
}
