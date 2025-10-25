import type { Sprite } from "../sprite.js";
import type { LumenLoopState } from "../../runtime/state/game_state.js";
import {
  LUMEN_LOOP_BASE_RADIUS,
  LUMEN_LOOP_MIN_SCALE,
  LUMEN_LOOP_MAX_SCALE,
  LUMEN_LOOP_GLOW_THICKNESS,
  LUMEN_LOOP_ROTATION_TO_VELOCITY,
  LUMEN_LOOP_ANGULAR_DECAY,
  LUMEN_LOOP_PINCH_RESPONSIVENESS,
  LUMEN_LOOP_HELIUM_FLOAT_FORCE,
  LUMEN_LOOP_HELIUM_BLEED_RATE,
  LUMEN_LOOP_ENERGY_DRAIN_PER_ROTATION,
  LUMEN_LOOP_JUMP_IMPULSE_SCALE,
  LUMEN_LOOP_INERTIA_MULT_MIN,
  LUMEN_LOOP_INERTIA_MULT_MAX,
  LUMEN_LOOP_ENERGY_MULT_MIN,
  LUMEN_LOOP_ENERGY_MULT_MAX,
  LUMEN_LOOP_HELIUM_SCALE_RETURN_RATE,
  LUMEN_LOOP_PEDAL_IMPULSE,
  LUMEN_LOOP_PEDAL_MOMENTUM_MAX,
  MIN_RIDE_SPEED,
  MAX_RIDE_SPEED,
  ENERGY_MAX,
} from "../../config/constants.js";
import { clamp } from "../../shared/utils.js";
import {
  computePixelStripGlow,
  drawPixelStripDots,
} from "../rendering/pixelStrip.js";
const TWO_PI = Math.PI * 2;
const HALO_SEGMENTS = 36;
const PINCH_DECAY_PER_SECOND = 4;
const HELIUM_CAP = 3;
const BASE_HALO_COLOR = "#f5f797";
const HELIUM_HALO_COLOR = "#9be7ff";
const BASE_HALO_SCALE = 1;
const HORIZONTAL_STOP_EPSILON = MIN_RIDE_SPEED * 0.25;
export interface LumenLoopActivationOptions {
  scale?: number;
  unlocked?: boolean;
}
export interface LumenLoopUpdateInput {
  rotationDelta?: number; // radians accumulated this frame
  dt: number;
}
export interface LumenLoopUpdateResult {
  horizontalVelocity: number;
  energySpent: number;
  heliumLift: number;
}
export interface LumenLoopDrawParams {
  ctx: CanvasRenderingContext2D;
  sprite: Sprite | null;
  cameraY: number;
  color?: string;
  segments?: number;
  pendingActivation?: boolean;
  accumulatedAngle?: number;
}
export function activateLumenLoop(
  state: LumenLoopState,
  options: LumenLoopActivationOptions = {},
): boolean {
  if (!state.isUnlocked && !options.unlocked) return false;
  state.isUnlocked = true;
  state.isActive = true;
  state.angularVelocity = 0;
  state.rotationAccum = 0;
  state.haloScale = clampScale(options.scale ?? state.haloScale ?? 1);
  state.pinchIntent = 0;
  state.cooldownTime = 0;
  return true;
}
export function deactivateLumenLoop(state: LumenLoopState): void {
  state.isActive = false;
  state.angularVelocity = 0;
  state.rotationAccum = 0;
  state.pinchIntent = 0;
}
export function updateLumenLoopState(
  state: LumenLoopState,
  input: LumenLoopUpdateInput,
): LumenLoopUpdateResult {
  const dt = Math.max(0.0001, input.dt);
  if (!state.isActive) {
    bleedHelium(state, dt);
    decayPinchIntent(state, dt);
    return { horizontalVelocity: 0, energySpent: 0, heliumLift: 0 };
  }
  const rotationDelta = input.rotationDelta ?? 0;
  state.rotationAccum += rotationDelta;
  const haloScale = clampScale(state.haloScale);
  const inertiaMultiplier = scaleLerp(
    haloScale,
    LUMEN_LOOP_INERTIA_MULT_MIN,
    LUMEN_LOOP_INERTIA_MULT_MAX,
  );
  const pedalFraction = rotationDelta / TWO_PI;
  const pedalImpulse =
    (pedalFraction * LUMEN_LOOP_PEDAL_IMPULSE) /
    Math.max(0.2, inertiaMultiplier);
  state.angularVelocity += pedalImpulse;
  const scaleVelocityMultiplier = haloScale;
  const momentumCap =
    LUMEN_LOOP_PEDAL_MOMENTUM_MAX * Math.max(0.25, scaleVelocityMultiplier);
  state.angularVelocity = clamp(
    state.angularVelocity,
    -momentumCap,
    momentumCap,
  );
  const decayFactor = Math.exp(-LUMEN_LOOP_ANGULAR_DECAY * dt);
  state.angularVelocity *= decayFactor;
  const rawHorizontalVelocity =
    state.angularVelocity *
    LUMEN_LOOP_ROTATION_TO_VELOCITY *
    scaleVelocityMultiplier;
  const horizontalVelocity = clampRideVelocity(rawHorizontalVelocity);
  // Inertia-based energy drain system
  // Energy only drains when there's active rotation input (not during coasting)
  let energySpent = 0;
  if (rotationDelta !== 0) {
    const energyMultiplier = scaleLerp(
      haloScale,
      LUMEN_LOOP_ENERGY_MULT_MIN,
      LUMEN_LOOP_ENERGY_MULT_MAX,
    );
    
    // Calculate base energy cost from rotation amount
    const rotations = Math.abs(rotationDelta) / TWO_PI;
    const baseEnergyCost = rotations * LUMEN_LOOP_ENERGY_DRAIN_PER_ROTATION * energyMultiplier;
    
    // Calculate inertia factor: higher when velocity is low (overcoming torque)
    // When angular velocity is zero or near-zero, inertia factor is maximum (1.0)
    // As momentum builds, inertia factor decreases (easier to maintain speed)
    const normalizedVelocity = Math.abs(state.angularVelocity) / momentumCap;
    const inertiaFactor = 1.0 - (normalizedVelocity * 0.7); // Reduces drain by up to 70% at max momentum
    
    // Apply inertia-based multiplier to energy cost
    const rawEnergyCost = baseEnergyCost * Math.max(0.3, inertiaFactor);
    
    energySpent = consumeEnergy(state, rawEnergyCost);
  }
  // No energy drain during coasting (when rotationDelta === 0)
  bleedHelium(state, dt);
  decayPinchIntent(state, dt);
  const heliumLift = state.heliumAmount * LUMEN_LOOP_HELIUM_FLOAT_FORCE;
  return {
    horizontalVelocity,
    energySpent,
    heliumLift,
  };
}
export function applyPinch(
  state: LumenLoopState,
  deltaScale: number,
): { scale: number; shouldDismiss: boolean } {
  if (!state.isActive) {
    return { scale: state.haloScale, shouldDismiss: false };
  }
  const scaledDelta = deltaScale * LUMEN_LOOP_PINCH_RESPONSIVENESS;
  const nextScale = clampScale(state.haloScale + scaledDelta);
  state.haloScale = nextScale;
  state.pinchIntent = deltaScale;
  const atMinimum = nextScale <= LUMEN_LOOP_MIN_SCALE + 0.01;
  const shouldDismiss = atMinimum && deltaScale < 0;
  return { scale: state.haloScale, shouldDismiss };
}
export function applyHelium(state: LumenLoopState, amount: number): number {
  const nextAmount = clamp(state.heliumAmount + amount, 0, HELIUM_CAP);
  state.heliumAmount = nextAmount;
  if (amount > 0) state.heliumFloatTimer = 0;
  return state.heliumAmount;
}
export function consumeEnergy(state: LumenLoopState, amount: number): number {
  if (amount <= 0) return 0;
  const prev = state.energy;
  state.energy = clamp(prev - amount, 0, ENERGY_MAX);
  return prev - state.energy;
}
export interface LumenLoopJumpResult {
  direction: { x: number; y: number };
  impulseScale: number;
}
export function triggerLumenLoopJump(
  state: LumenLoopState,
  direction: { x: number; y: number },
): LumenLoopJumpResult {
  state.cooldownTime = 0;
  state.angularVelocity = 0;
  return { direction, impulseScale: LUMEN_LOOP_JUMP_IMPULSE_SCALE };
}

function drawPendingActivationHalo(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  cameraY: number,
  accumulatedAngle: number,
): void {
  const centerX = sprite.x;
  const centerY = sprite.y - cameraY;
  
  // Calculate arc completion percentage (0 to 1)
  const completionPercentage = Math.min(Math.abs(accumulatedAngle) / TWO_PI, 1);
  
  // Base radius for pending activation
  const radius = LUMEN_LOOP_BASE_RADIUS;
  
  // Visual parameters for pending state
  const pendingColor = BASE_HALO_COLOR;
  const thickness = LUMEN_LOOP_GLOW_THICKNESS * 0.7; // Slightly thinner during activation
  
  // Calculate glow that intensifies as we approach completion
  const glowIntensity = 1.5 + completionPercentage * 1.5;
  const glowBlur = computePixelStripGlow(Math.max(2, Math.round(thickness)), {
    glow: {
      multiplier: glowIntensity,
      min: 8,
    },
  });
  
  // Calculate how many segments to render based on completion
  const totalSegments = HALO_SEGMENTS;
  const segmentsToRender = Math.max(1, Math.round(totalSegments * completionPercentage));
  
  const segmentLength = Math.max(
    4,
    (TWO_PI * radius) / Math.max(totalSegments, 12) / 2,
  );
  
  const dotStyle = {
    dotSize: Math.max(2, thickness * 0.5),
    spacing: 2,
  };
  
  // Alpha increases as we approach completion
  ctx.globalAlpha = 0.4 + completionPercentage * 0.3;
  
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.fillStyle = pendingColor;
  ctx.shadowColor = pendingColor;
  ctx.shadowBlur = glowBlur;
  
  // Render arc segments proportional to rotation progress
  // Start from top (angle 0) and go in the direction of rotation
  const startAngle = -Math.PI / 2; // Start at top
  const rotationDirection = Math.sign(accumulatedAngle) || 1;
  
  for (let i = 0; i < segmentsToRender; i++) {
    const angle = startAngle + (i / totalSegments) * TWO_PI * rotationDirection;
    ctx.save();
    ctx.rotate(angle);
    drawPixelStripDots({
      ctx,
      startX: radius - segmentLength / 2,
      startY: -thickness / 2,
      length: segmentLength,
      thickness: Math.max(2, Math.round(thickness)),
      orientation: "horizontal",
      style: dotStyle,
    });
    ctx.restore();
  }
  
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawLumenLoop(
  state: LumenLoopState,
  params: LumenLoopDrawParams,
): void {
  const { ctx, sprite, cameraY, segments = HALO_SEGMENTS, pendingActivation = false, accumulatedAngle = 0 } = params;
  
  // Render partial halo during activation gesture
  if (pendingActivation && !state.isActive) {
    if (!sprite) return;
    drawPendingActivationHalo(ctx, sprite, cameraY, accumulatedAngle);
    return;
  }
  
  if (!state.isActive) return;
  if (!sprite) return;
  const haloScale = clampScale(state.haloScale);
  const scaleT = scaleLerp(haloScale, 0, 1);
  const angularIntensity = clamp(
    Math.abs(state.angularVelocity) / (TWO_PI * 3.5),
    0,
    1,
  );
  const heliumFraction =
    state.heliumAmount > 0 ? clamp(state.heliumAmount / HELIUM_CAP, 0, 1) : 0;
  const heliumBleedProgress = heliumFraction > 0 ? 1 - heliumFraction : 0;
  const bleedPulse =
    heliumBleedProgress > 0
      ? Math.sin(state.heliumFloatTimer * 5.5) *
        0.05 *
        heliumBleedProgress
      : 0;
  const radius =
    LUMEN_LOOP_BASE_RADIUS *
    haloScale *
    Math.max(0.75, 1 - heliumBleedProgress * 0.2 - bleedPulse);
  const haloColor = lerpColor(
    BASE_HALO_COLOR,
    HELIUM_HALO_COLOR,
    clamp(state.heliumAmount / HELIUM_CAP, 0, 1),
  );
  const centerX = sprite.x;
  const centerY = sprite.y - cameraY;
  const thicknessBase =
    LUMEN_LOOP_GLOW_THICKNESS * (0.85 + scaleT * 0.6 + angularIntensity * 0.4);
  const thickness = Math.max(2, Math.round(thicknessBase));
  const glowBlur = computePixelStripGlow(thickness, {
    glow: {
      multiplier: 2.5 + angularIntensity * 2,
      min: 10,
    },
  });
  const segmentLength = Math.max(
    4,
    (TWO_PI * radius) / Math.max(segments, 12) / 2,
  );
  const dotStyle = {
    dotSize: Math.max(2, thickness * 0.5),
    spacing: Math.max(1, 2 - angularIntensity),
  };
  ctx.globalAlpha = clamp(0.55 + angularIntensity * 0.45, 0.55, 1);
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.fillStyle = haloColor;
  ctx.shadowColor = haloColor;
  ctx.shadowBlur = glowBlur;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * TWO_PI;
    ctx.save();
    ctx.rotate(angle);
    drawPixelStripDots({
      ctx,
      startX: radius - segmentLength / 2,
      startY: -thickness / 2,
      length: segmentLength,
      thickness,
      orientation: "horizontal",
      style: dotStyle,
    });
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
function clampScale(scale: number): number {
  return clamp(scale, LUMEN_LOOP_MIN_SCALE, LUMEN_LOOP_MAX_SCALE);
}
function scaleLerp(scale: number, min: number, max: number): number {
  if (LUMEN_LOOP_MAX_SCALE === LUMEN_LOOP_MIN_SCALE) return min;
  const t = clamp(
    (scale - LUMEN_LOOP_MIN_SCALE) /
      (LUMEN_LOOP_MAX_SCALE - LUMEN_LOOP_MIN_SCALE),
    0,
    1,
  );
  return min + (max - min) * t;
}

function clampRideVelocity(velocity: number): number {
  if (!Number.isFinite(velocity)) return 0;
  const absValue = Math.abs(velocity);
  if (absValue <= HORIZONTAL_STOP_EPSILON) return 0;
  const limited = clamp(absValue, Math.max(0, MIN_RIDE_SPEED), MAX_RIDE_SPEED);
  return Math.sign(velocity) * limited;
}
function bleedHelium(state: LumenLoopState, dt: number): void {
  if (state.heliumAmount <= 0) {
    state.heliumFloatTimer = 0;
    return;
  }
  const drain = LUMEN_LOOP_HELIUM_BLEED_RATE * dt;
  state.heliumAmount = Math.max(0, state.heliumAmount - drain);
  if (state.heliumAmount > 0 || state.heliumFloatTimer > 0) {
    relaxHaloScaleTowardBase(state, dt);
  }
  state.heliumFloatTimer += dt;
  if (state.heliumAmount <= 0) state.heliumFloatTimer = 0;
}
function decayPinchIntent(state: LumenLoopState, dt: number): void {
  if (state.pinchIntent === 0) return;
  const decay = PINCH_DECAY_PER_SECOND * dt;
  if (Math.abs(state.pinchIntent) <= decay) {
    state.pinchIntent = 0;
    return;
  }
  state.pinchIntent += state.pinchIntent > 0 ? -decay : decay;
}
function lerpColor(start: string, end: string, t: number): string {
  const parse = (hex: string) => {
    const normalized = hex.replace("#", "");
    const bigint = parseInt(normalized, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
    };
  };
  const a = parse(start);
  const b = parse(end);
  const mix = (channelA: number, channelB: number) =>
    Math.round(channelA + (channelB - channelA) * clamp(t, 0, 1));
  return `rgb(${mix(a.r, b.r)}, ${mix(a.g, b.g)}, ${mix(a.b, b.b)})`;
}

function relaxHaloScaleTowardBase(
  state: LumenLoopState,
  dt: number,
): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const settle = Math.min(1, dt * LUMEN_LOOP_HELIUM_SCALE_RETURN_RATE);
  if (settle <= 0) return;
  state.haloScale += (BASE_HALO_SCALE - state.haloScale) * settle;
}
