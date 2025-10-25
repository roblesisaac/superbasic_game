import type { Sprite } from "../sprite.js";
import type { LumenLoopState } from "../../runtime/state/game_state.js";
import {
  LUMEN_LOOP_BASE_RADIUS,
  LUMEN_LOOP_ACTIVATION_ANGLE,
  LUMEN_LOOP_PEDAL_IMPULSE,
  LUMEN_LOOP_PEDAL_MOMENTUM_MAX,
  LUMEN_LOOP_ANGULAR_DECAY,
  LUMEN_LOOP_ENERGY_DRAIN_PER_ROTATION,
  LUMEN_LOOP_ROTATION_TO_VELOCITY,
  MIN_RIDE_SPEED,
  MAX_RIDE_SPEED,
} from "../../config/constants.js";

export interface LumenLoopGestureState {
  pointerId: number | null;
  lastAngle: number;
  accumulatedAngle: number;
  pendingActivation: boolean;
  dragStart: { x: number; y: number; time: number } | null;
  lastSample: { x: number; y: number; time: number } | null;
  jumpDragStart: { x: number; y: number; time: number } | null;
  claimedInput: boolean;
  startAngle: number;
}

export function createLumenLoopGestureState(): LumenLoopGestureState {
  return {
    pointerId: null,
    lastAngle: 0,
    accumulatedAngle: 0,
    pendingActivation: false,
    dragStart: null,
    lastSample: null,
    jumpDragStart: null,
    claimedInput: false,
    startAngle: 0,
  };
}

/**
 * Draw the Lumen-Loop halo with progressive rendering during activation
 */
export function drawLumenLoop(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  state: LumenLoopState,
  gestureState: LumenLoopGestureState,
  cameraY: number,
): void {
  if (!state.isActive && !gestureState.pendingActivation) {
    return;
  }

  const screenX = sprite.x;
  const screenY = sprite.y - cameraY;
  const radius = LUMEN_LOOP_BASE_RADIUS * state.haloScale;

  ctx.save();

  if (gestureState.pendingActivation) {
    // Progressive rendering during activation gesture
    const completion = Math.min(
      1,
      gestureState.accumulatedAngle / LUMEN_LOOP_ACTIVATION_ANGLE,
    );
    const arcAngle = completion * Math.PI * 2;

    // Draw partial arc with glow effect
    ctx.strokeStyle = "#f5f797";
    ctx.lineWidth = 3;
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#f5f797";

    ctx.beginPath();
    ctx.arc(
      screenX,
      screenY,
      radius,
      gestureState.startAngle,
      gestureState.startAngle + arcAngle,
    );
    ctx.stroke();

    // Add dots along the arc for pixelated effect
    const numDots = Math.floor(completion * 36);
    ctx.fillStyle = "#f5f797";
    ctx.shadowBlur = 6;

    for (let i = 0; i <= numDots; i++) {
      const angle = gestureState.startAngle + (i / 36) * Math.PI * 2;
      const dotX = screenX + Math.cos(angle) * radius;
      const dotY = screenY + Math.sin(angle) * radius;
      ctx.fillRect(dotX - 2, dotY - 2, 4, 4);
    }
  } else if (state.isActive) {
    // Full halo rendering when active
    const glowIntensity = Math.min(1, Math.abs(state.angularVelocity) / 3);
    const baseColor = "#f5f797";
    const heliumColor = "#9be7ff";

    // Lerp color based on helium amount
    const heliumFactor = Math.min(1, state.heliumAmount / 3);
    const color = lerpColor(baseColor, heliumColor, heliumFactor);

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 8 + glowIntensity * 12;
    ctx.shadowColor = color;

    // Draw full circle
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw pixel dots around the circle
    const numDots = 36;
    ctx.fillStyle = color;
    ctx.shadowBlur = 6 + glowIntensity * 8;

    for (let i = 0; i < numDots; i++) {
      const angle = (i / numDots) * Math.PI * 2 + state.rotationAccum;
      const dotX = screenX + Math.cos(angle) * radius;
      const dotY = screenY + Math.sin(angle) * radius;
      const dotSize = 3 + glowIntensity * 2;
      ctx.fillRect(dotX - dotSize / 2, dotY - dotSize / 2, dotSize, dotSize);
    }
  }

  ctx.restore();
}

/**
 * Linear interpolation between two hex colors
 */
function lerpColor(color1: string, color2: string, t: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Start the Lumen-Loop activation gesture
 */
export function startLumenLoopGesture(
  gestureState: LumenLoopGestureState,
  sprite: Sprite,
  x: number,
  y: number,
  cameraY: number,
): void {
  const spriteScreenY = sprite.y - cameraY;
  const dx = x - sprite.x;
  const dy = y - spriteScreenY;
  const angle = Math.atan2(dy, dx);

  gestureState.pendingActivation = true;
  gestureState.lastAngle = angle;
  gestureState.startAngle = angle;
  gestureState.accumulatedAngle = 0;
  gestureState.dragStart = { x, y, time: Date.now() };
  gestureState.lastSample = { x, y, time: Date.now() };
  gestureState.claimedInput = false;
}

/**
 * Update rotation during activation gesture
 */
export function updateLumenLoopRotation(
  gestureState: LumenLoopGestureState,
  sprite: Sprite,
  x: number,
  y: number,
  cameraY: number,
): void {
  if (!gestureState.pendingActivation) return;

  const spriteScreenY = sprite.y - cameraY;
  const dx = x - sprite.x;
  const dy = y - spriteScreenY;
  const currentAngle = Math.atan2(dy, dx);

  let delta = currentAngle - gestureState.lastAngle;

  // Handle angle wrapping
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;

  gestureState.accumulatedAngle += Math.abs(delta);
  gestureState.lastAngle = currentAngle;
  gestureState.lastSample = { x, y, time: Date.now() };

  // Claim input after ~120 degrees to prevent conflicts
  if (gestureState.accumulatedAngle > (Math.PI * 2) / 3) {
    gestureState.claimedInput = true;
  }
}

/**
 * Activate the Lumen-Loop when gesture completes
 */
export function activateLumenLoop(
  state: LumenLoopState,
  gestureState: LumenLoopGestureState,
): void {
  if (gestureState.accumulatedAngle >= LUMEN_LOOP_ACTIVATION_ANGLE) {
    state.isActive = true;
    state.angularVelocity = 0;
    state.haloScale = 1.0;
    gestureState.pendingActivation = false;
  }
}

/**
 * Deactivate the Lumen-Loop
 */
export function deactivateLumenLoop(
  state: LumenLoopState,
  gestureState: LumenLoopGestureState,
): void {
  state.isActive = false;
  state.angularVelocity = 0;
  state.rotationAccum = 0;
  state.haloScale = 1.0;
  state.heliumAmount = 0;
  state.heliumFloatTimer = 0;
  gestureState.pendingActivation = false;
  gestureState.accumulatedAngle = 0;
  gestureState.claimedInput = false;
}

/**
 * Update Lumen-Loop physics and energy drain based on rotation input
 * 
 * @param state - The Lumen-Loop state
 * @param dt - Delta time in seconds
 * @param rotationDelta - Rotation input in radians (0 if no input)
 * @param hasRotationInput - Whether player is actively rotating
 * @returns The horizontal velocity to apply to the sprite
 */
export function updateLumenLoopState(
  state: LumenLoopState,
  dt: number,
  rotationDelta: number,
  hasRotationInput: boolean,
): number {
  if (!state.isActive) {
    return 0;
  }

  // Calculate inertia multiplier based on halo scale
  // Larger halos = more inertia = harder to accelerate
  const inertiaMultiplier = state.haloScale;

  // Calculate momentum cap based on halo scale
  const momentumCap = LUMEN_LOOP_PEDAL_MOMENTUM_MAX * state.haloScale;

  if (hasRotationInput && rotationDelta !== 0) {
    // Player is actively rotating - apply acceleration and energy drain

    // Calculate pedal impulse scaled by inertia
    const impulse = (Math.abs(rotationDelta) / (Math.PI * 2)) * 
                    LUMEN_LOOP_PEDAL_IMPULSE / inertiaMultiplier;

    // Determine direction from rotation delta
    const direction = rotationDelta > 0 ? 1 : -1;

    // Apply impulse to angular velocity
    state.angularVelocity += impulse * direction;

    // Clamp to momentum cap
    state.angularVelocity = Math.max(
      -momentumCap,
      Math.min(momentumCap, state.angularVelocity)
    );

    // Calculate energy drain based on inertia (acceleration effort)
    // Maximum drain when starting from rest (overcoming initial torque)
    // Reduced drain when momentum exists
    const currentSpeed = Math.abs(state.angularVelocity);
    const maxSpeed = momentumCap;
    
    // Inertia factor: 1.0 at rest, approaches 0 at max speed
    // This represents the effort needed to overcome inertia
    const inertiaFactor = 1.0 - Math.min(1.0, currentSpeed / maxSpeed);
    
    // Base energy drain per rotation
    const rotationAmount = Math.abs(rotationDelta) / (Math.PI * 2);
    const baseDrain = rotationAmount * LUMEN_LOOP_ENERGY_DRAIN_PER_ROTATION;
    
    // Scale drain by inertia factor (more drain when starting from rest)
    // Minimum 30% drain even at max speed, maximum 100% drain at rest
    const inertiaScale = 0.3 + (inertiaFactor * 0.7);
    
    // Scale by halo size (larger halos require more energy)
    const energyMultiplier = state.haloScale;
    
    const energyDrain = baseDrain * inertiaScale * energyMultiplier;

    // Apply energy drain
    state.energy = Math.max(0, state.energy - energyDrain);

    // If energy depleted, prevent further acceleration
    if (state.energy <= 0) {
      // Allow coasting but no new acceleration
      // Angular velocity will naturally decay
    }
  } else {
    // No rotation input - coasting with decay
    // No energy drain during coasting
    
    if (state.angularVelocity !== 0) {
      const decayAmount = LUMEN_LOOP_ANGULAR_DECAY * dt;
      
      if (Math.abs(state.angularVelocity) < decayAmount) {
        state.angularVelocity = 0;
      } else {
        const direction = state.angularVelocity > 0 ? 1 : -1;
        state.angularVelocity -= decayAmount * direction;
      }
    }
  }

  // Update rotation accumulator for visual rotation
  state.rotationAccum += state.angularVelocity * dt;

  // Convert angular velocity to horizontal velocity
  const horizontalVelocity = 
    state.angularVelocity * LUMEN_LOOP_ROTATION_TO_VELOCITY * state.haloScale;

  // Clamp to ride speed limits
  return Math.max(
    -MAX_RIDE_SPEED,
    Math.min(MAX_RIDE_SPEED, horizontalVelocity)
  );
}
