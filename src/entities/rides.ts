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
  RIDE_IMPACT_PHASE_DURATION,
  RIDE_ABSORPTION_PHASE_DURATION,
  RIDE_RECOVERY_PHASE_DURATION,
  RIDE_SETTLE_PHASE_DURATION,
  RIDE_RECOVERY_OVERSHOOT,
  RIDE_VELOCITY_IMPACT_FACTOR,
  RIDE_LAUNCH_LIFT_DURATION,
  RIDE_LAUNCH_RELEASE_DURATION,
  RIDE_LAUNCH_SETTLE_DURATION,
  RIDE_LAUNCH_LIFT_INTENSITY,
  RIDE_LAUNCH_VELOCITY_FACTOR,
} from '../config/constants.js';
import { clamp, rectsIntersect } from '../utils/utils.js';
import { asciiArtEnabled } from '../systems/settings.js';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim();
  const match = /^#?([0-9a-fA-F]{6})$/.exec(normalized.startsWith('#') ? normalized : `#${normalized}`);
  if (!match) return null;

  const value = parseInt(match[1], 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

type LandingPhase = 'idle' | 'impact' | 'absorption' | 'recovery' | 'settle';
type LaunchPhase = 'idle' | 'lift' | 'release' | 'settle';

export class Ride {
  x: number;
  baseY: number;
  y: number;
  width: number;
  speed: number;
  direction: number;
  canvasWidth: number;
  active: boolean;
  floating: boolean;
  floatTime: number;
  originalSpeed: number;
  weightOffset: number;
  landingPhase: LandingPhase;
  phaseTime: number;
  impactIntensity: number;
  targetDip: number;
  landingVelocity: number;
  launchPhase: LaunchPhase;
  launchPhaseTime: number;
  launchIntensity: number;
  targetLift: number;
  launchVelocity: number;

  constructor({ x, y, width, speed, direction, canvasWidth }: {
    x: number;
    y: number;
    width: number;
    speed: number;
    direction: number;
    canvasWidth: number;
  }) {
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

    // Hoverboard landing physics state
    this.weightOffset = 0;
    this.landingPhase = 'idle'; // 'impact', 'absorption', 'recovery', 'settle'
    this.phaseTime = 0;
    this.impactIntensity = 0;
    this.targetDip = 0;
    this.landingVelocity = 0; // Store sprite's landing velocity for impact calculation
    
    // Launch effect state
    this.launchPhase = 'idle'; // 'lift', 'release', 'settle'
    this.launchPhaseTime = 0;
    this.launchIntensity = 0;
    this.targetLift = 0;
    this.launchVelocity = 0; // Store sprite's launch velocity for effect calculation
    
    this._applyWeightOffset();
  }

  update(dt) {
    if (!this.active) return;

    this._updateWeightShift(dt);
    this._updateLaunchEffect(dt);

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

    if (asciiArtEnabled) {
      ctx.fillStyle = color;
      ctx.font = '16px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const count = Math.max(1, Math.floor(this.width / 8));
      const ascii = '='.repeat(count);
      ctx.fillText(ascii, this.x, this.y - cameraY);
    } else {
      const visualThickness = Math.max(1, Math.round(RIDE_THICKNESS / 5));
      const offsetY = this.y - cameraY - visualThickness / 2;
      const rgb = hexToRgb(color);
      if (rgb) {
        const glowHeight = Math.max(visualThickness * 2, 10);
        const glowSpread = Math.max(visualThickness * 1.5, 12);
        const baseOpacity = this.floating ? 0.35 : 0.25;

        ctx.save();
        const gradient = ctx.createLinearGradient(
          0,
          offsetY - glowHeight,
          0,
          offsetY + visualThickness + glowHeight,
        );
        gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
        gradient.addColorStop(0.45, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseOpacity * 0.25})`);
        gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseOpacity})`);
        gradient.addColorStop(0.55, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseOpacity * 0.25})`);
        gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(
          this.x - glowSpread / 2,
          offsetY - glowHeight,
          this.width + glowSpread,
          visualThickness + glowHeight * 2,
        );
        ctx.restore();
      }

      ctx.fillStyle = color;
      ctx.fillRect(this.x, offsetY, this.width, visualThickness);
    }
  }

  getRect() {
    // Use baseY for collision detection to prevent bouncing during landing animation
    // Visual position (this.y) includes weightOffset, but collision should use stable position
    return {
      x: this.x,
      y: this.baseY - RIDE_THICKNESS / 2,
      w: this.width,
      h: RIDE_THICKNESS
    };
  }

  getVisualYOffset() {
    // Current visual offset from base position (used for drawing-only bobbing)
    return this.y - this.baseY;
  }

  applyWeightShift(spriteVelocity = 0) {
    // Calculate impact intensity based on sprite's landing velocity
    const velocityImpact = Math.abs(spriteVelocity) * RIDE_VELOCITY_IMPACT_FACTOR;
    const baseIntensity = RIDE_WEIGHT_SHIFT_MIN + Math.random() * (RIDE_WEIGHT_SHIFT_MAX - RIDE_WEIGHT_SHIFT_MIN);
    
    this.impactIntensity = Math.min(RIDE_WEIGHT_SHIFT_MAX, baseIntensity + velocityImpact);
    this.targetDip = this.impactIntensity;
    this.landingVelocity = spriteVelocity;
    
    // Start the impact phase
    this.landingPhase = 'impact';
    this.phaseTime = 0;
    this._applyWeightOffset();
  }

  applyLaunchEffect(spriteVelocity = 0) {
    // Calculate launch intensity based on sprite's launch velocity
    const velocityImpact = Math.abs(spriteVelocity) * RIDE_LAUNCH_VELOCITY_FACTOR;
    const baseIntensity = RIDE_WEIGHT_SHIFT_MAX * RIDE_LAUNCH_LIFT_INTENSITY;
    
    this.launchIntensity = Math.min(RIDE_WEIGHT_SHIFT_MAX, baseIntensity + velocityImpact);
    this.targetLift = this.launchIntensity;
    this.launchVelocity = spriteVelocity;
    
    // Start the lift phase
    this.launchPhase = 'lift';
    this.launchPhaseTime = 0;
    this._applyWeightOffset();
  }

  _updateWeightShift(dt) {
    if (!Number.isFinite(dt)) {
      this._applyWeightOffset();
      return;
    }

    if (this.landingPhase === 'idle') {
      this._applyWeightOffset();
      return;
    }

    this.phaseTime += dt;

    switch (this.landingPhase) {
      case 'impact':
        this._updateImpactPhase();
        break;
      case 'absorption':
        this._updateAbsorptionPhase();
        break;
      case 'recovery':
        this._updateRecoveryPhase();
        break;
      case 'settle':
        this._updateSettlePhase();
        break;
    }

    this._applyWeightOffset();
  }

  _updateImpactPhase() {
    const duration = RIDE_IMPACT_PHASE_DURATION;
    const t = clamp(this.phaseTime / duration, 0, 1);
    
    // Quick, sharp dip with ease-out
    const eased = 1 - Math.pow(1 - t, 2);
    this.weightOffset = this.targetDip * eased;

    if (t >= 1) {
      this.landingPhase = 'absorption';
      this.phaseTime = 0;
    }
  }

  _updateAbsorptionPhase() {
    const duration = RIDE_ABSORPTION_PHASE_DURATION;
    const t = clamp(this.phaseTime / duration, 0, 1);
    
    // Gradual weight absorption with slight settling
    const settling = 1 + (0.08 * (1 - Math.cos(t * Math.PI * 2)) * (1 - t)); // Gentle settling oscillation
    this.weightOffset = this.targetDip * settling;

    if (t >= 1) {
      this.landingPhase = 'recovery';
      this.phaseTime = 0;
    }
  }

  _updateRecoveryPhase() {
    const duration = RIDE_RECOVERY_PHASE_DURATION;
    const t = clamp(this.phaseTime / duration, 0, 1);
    
    // Natural bounce-back with overshoot - hoverboard compensates for the weight
    const eased = 1 - Math.pow(1 - t, 1.8); // Smooth ease out
    const overshootAmount = this.targetDip * RIDE_RECOVERY_OVERSHOOT;
    
    // Transition from full dip to slight overshoot above original position
    this.weightOffset = this.targetDip * (1 - eased) - overshootAmount * eased;

    if (t >= 1) {
      this.landingPhase = 'settle';
      this.phaseTime = 0;
    }
  }

  _updateSettlePhase() {
    const duration = RIDE_SETTLE_PHASE_DURATION;
    const t = clamp(this.phaseTime / duration, 0, 1);
    
    // Gentle damped oscillation settling to natural hover position
    const damping = Math.exp(-4 * t); // Exponential decay
    const frequency = 3; // Number of oscillations
    const oscillation = Math.cos(t * Math.PI * frequency) * damping;
    const startingOffset = -this.targetDip * RIDE_RECOVERY_OVERSHOOT;
    
    // Gradually settle from the overshoot position to neutral
    this.weightOffset = startingOffset * oscillation * (1 - t * t); // Quadratic fade

    if (t >= 1) {
      this.weightOffset = 0;
      this.landingPhase = 'idle';
      this.phaseTime = 0;
      this.impactIntensity = 0;
      this.targetDip = 0;
    }
  }

  _applyWeightOffset() {
    // Combine both landing weight shift and launch effect
    let totalOffset = this.weightOffset;
    
    // Launch effect creates an upward lift (negative offset)
    if (this.launchPhase !== 'idle') {
      totalOffset -= this.getLaunchOffset();
    }
    
    this.y = this.baseY + totalOffset;
  }

  getLaunchOffset() {
    // Returns the current launch effect offset (positive = upward lift)
    switch (this.launchPhase) {
      case 'lift':
        return this.getLiftOffset();
      case 'release':
        return this.getReleaseOffset();
      case 'settle':
        return this.getSettleOffset();
      default:
        return 0;
    }
  }

  _updateLaunchEffect(dt) {
    if (!Number.isFinite(dt)) {
      return;
    }

    if (this.launchPhase === 'idle') {
      return;
    }

    this.launchPhaseTime += dt;

    switch (this.launchPhase) {
      case 'lift':
        this._updateLiftPhase();
        break;
      case 'release':
        this._updateReleasePhase();
        break;
      case 'settle':
        this._updateLaunchSettlePhase();
        break;
    }
  }

  _updateLiftPhase() {
    const duration = RIDE_LAUNCH_LIFT_DURATION;
    const t = clamp(this.launchPhaseTime / duration, 0, 1);
    
    if (t >= 1) {
      this.launchPhase = 'release';
      this.launchPhaseTime = 0;
    }
  }

  _updateReleasePhase() {
    const duration = RIDE_LAUNCH_RELEASE_DURATION;
    const t = clamp(this.launchPhaseTime / duration, 0, 1);
    
    if (t >= 1) {
      this.launchPhase = 'settle';
      this.launchPhaseTime = 0;
    }
  }

  _updateLaunchSettlePhase() {
    const duration = RIDE_LAUNCH_SETTLE_DURATION;
    const t = clamp(this.launchPhaseTime / duration, 0, 1);
    
    if (t >= 1) {
      this.launchPhase = 'idle';
      this.launchPhaseTime = 0;
      this.launchIntensity = 0;
      this.targetLift = 0;
    }
  }

  getLiftOffset() {
    const duration = RIDE_LAUNCH_LIFT_DURATION;
    const t = clamp(this.launchPhaseTime / duration, 0, 1);
    
    // Quick upward lift with ease-out
    const eased = 1 - Math.pow(1 - t, 2);
    return this.targetLift * eased;
  }

  getReleaseOffset() {
    const duration = RIDE_LAUNCH_RELEASE_DURATION;
    const t = clamp(this.launchPhaseTime / duration, 0, 1);
    
    // Smooth release back down
    const eased = 1 - Math.pow(1 - t, 1.5);
    return this.targetLift * (1 - eased);
  }

  getSettleOffset() {
    const duration = RIDE_LAUNCH_SETTLE_DURATION;
    const t = clamp(this.launchPhaseTime / duration, 0, 1);
    
    // Gentle damped oscillation settling to neutral
    const damping = Math.exp(-3 * t);
    const oscillation = Math.cos(t * Math.PI * 2) * damping;
    
    // Small residual effect that fades out
    return this.targetLift * 0.1 * oscillation * (1 - t);
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
