import type { Sprite } from "../sprite.js";
import type { LumenLoopState } from "../../runtime/state/game_state.js";
import {
  LUMEN_LOOP_BASE_RADIUS,
  LUMEN_LOOP_ACTIVATION_ANGLE,
} from "../../config/constants.js";
import {
  computePixelStripGlow,
  drawPixelCircleArc,
  drawPixelCircleDots,
} from "../rendering/pixelStrip.js";

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
  cameraY: number
): void {
  if (!state.isActive && !gestureState.pendingActivation) {
    return;
  }

  const screenX = sprite.x;
  const screenY = sprite.y - cameraY;
  const radius = LUMEN_LOOP_BASE_RADIUS * state.haloScale;

  ctx.save();

  if (state.isActive) {
    // Full halo rendering when active
    const glowIntensity = Math.min(1, Math.abs(state.angularVelocity) / 3);
    const baseColor = "#f5f797";
    const heliumColor = "#9be7ff";

    // Lerp color based on helium amount
    const heliumFactor = Math.min(1, state.heliumAmount / 3);
    const color = lerpColor(baseColor, heliumColor, heliumFactor);

    // Draw pixel dots around the circle (no continuous line, just dots like rides/gates)
    const numDots = 76;
    const baseDotSize = 3;
    const dotSize = baseDotSize + glowIntensity * 2;
    const dotGlow = computePixelStripGlow(dotSize, { glow: { min: 6 } });

    // Draw dots with glow
    ctx.fillStyle = color;
    ctx.shadowBlur = dotGlow + glowIntensity * 8;
    ctx.shadowColor = color;

    drawPixelCircleDots({
      ctx,
      centerX: screenX,
      centerY: screenY,
      radius,
      dotSize,
      numDots,
      rotationOffset: state.rotationAccum,
    });

    // Draw dots again without glow for solid appearance (like gates do)
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;

    drawPixelCircleDots({
      ctx,
      centerX: screenX,
      centerY: screenY,
      radius,
      dotSize,
      numDots,
      rotationOffset: state.rotationAccum,
    });
  } else if (gestureState.pendingActivation) {
    // Progressive rendering during activation gesture
    const completion = Math.min(
      1,
      gestureState.accumulatedAngle / LUMEN_LOOP_ACTIVATION_ANGLE
    );
    const arcAngle = completion * Math.PI * 2;

    const color = "#f5f797";
    const dotSize = 4;
    const dotGlow = computePixelStripGlow(dotSize, { glow: { min: 6 } });

    // Draw pixel dots along the arc (no continuous line)
    ctx.fillStyle = color;
    ctx.shadowBlur = dotGlow;
    ctx.shadowColor = color;

    drawPixelCircleDots({
      ctx,
      centerX: screenX,
      centerY: screenY,
      radius,
      dotSize,
      numDots: 6,
      startAngle: gestureState.startAngle,
      endAngle: gestureState.startAngle + arcAngle,
    });

    // Draw dots again without glow for solid appearance
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;

    drawPixelCircleDots({
      ctx,
      centerX: screenX,
      centerY: screenY,
      radius,
      dotSize,
      numDots: 36,
      startAngle: gestureState.startAngle,
      endAngle: gestureState.startAngle + arcAngle,
    });
  } else if (state.isActive) {
    // Full halo rendering when active
    const glowIntensity = Math.min(1, Math.abs(state.angularVelocity) / 3);
    const baseColor = "#f5f797";
    const heliumColor = "#9be7ff";

    // Lerp color based on helium amount
    const heliumFactor = Math.min(1, state.heliumAmount / 3);
    const color = lerpColor(baseColor, heliumColor, heliumFactor);

    const lineThickness = 3;
    const baseGlow = computePixelStripGlow(lineThickness);

    ctx.strokeStyle = color;
    ctx.shadowBlur = baseGlow + glowIntensity * 12;
    ctx.shadowColor = color;

    // Draw full circle
    drawPixelCircleArc({
      ctx,
      centerX: screenX,
      centerY: screenY,
      radius,
      lineWidth: lineThickness,
    });

    // Draw pixel dots around the circle
    const numDots = 36;
    const baseDotSize = 3;
    const dotSize = baseDotSize + glowIntensity * 2;
    const dotGlow = computePixelStripGlow(dotSize, { glow: { min: 6 } });

    ctx.fillStyle = color;
    ctx.shadowBlur = dotGlow + glowIntensity * 8;

    drawPixelCircleDots({
      ctx,
      centerX: screenX,
      centerY: screenY,
      radius,
      dotSize,
      numDots,
      rotationOffset: state.rotationAccum,
    });
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
  cameraY: number
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
  cameraY: number
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
  gestureState: LumenLoopGestureState
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
  gestureState: LumenLoopGestureState
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
 * Update Lumen-Loop physics based on rotation input
 * Matches the HTML example logic exactly
 *
 * @param state - The Lumen-Loop state
 * @param dt - Delta time in seconds
 * @param rotationDelta - Accumulated rotation input in radians
 * @returns The horizontal velocity to apply to the sprite
 */
export function updateLumenLoopState(
  state: LumenLoopState,
  dt: number,
  rotationDelta: number
): number {
  if (!state.isActive) {
    return 0;
  }

  // HTML example logic:
  // if (joystick.active && joystick.rotationDelta !== 0) {
  //   const rotationDirection = Math.sign(joystick.rotationDelta);
  //   sprite.velocity = rotationDirection * sprite.speed;
  //   joystick.rotationDelta *= 0.9;
  // } else {
  //   sprite.velocity *= 0.95;
  // }

  const SPEED = 200; // Horizontal speed (pixels per second)
  const DECAY = 0.95; // Velocity decay when not rotating

  if (rotationDelta !== 0) {
    // Player is actively rotating - set velocity directly
    const rotationDirection = Math.sign(rotationDelta);
    state.angularVelocity = rotationDirection * SPEED;
  } else {
    // No rotation input - apply decay
    state.angularVelocity *= DECAY;
    
    // Stop completely when velocity is very small
    if (Math.abs(state.angularVelocity) < 0.01) {
      state.angularVelocity = 0;
    }
  }

  // Update rotation accumulator for visual rotation
  state.rotationAccum += state.angularVelocity * dt;

  // Return velocity directly (no conversion needed)
  return state.angularVelocity;
}
