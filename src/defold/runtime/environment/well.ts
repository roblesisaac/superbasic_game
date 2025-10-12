import { clamp } from '../../../utils/utils.js';
import {
  SWIM_FORCE_MAX,
  SWIM_FORCE_MIN,
  WATER_MAX_SPEED,
  WELL_BOTTOM_DEPTH,
  WELL_OPENING_WIDTH,
  WELL_WALL_THICKNESS,
  WELL_WATER_SURFACE_OFFSET,
  WELL_BUBBLE_LARGE_CHANCE,
  WELL_BUBBLE_LARGE_RADIUS,
  WELL_BUBBLE_MAX_COUNT,
  WELL_BUBBLE_MAX_RADIUS,
  WELL_BUBBLE_MIN_RADIUS,
  WELL_BUBBLE_SPAWN_RATE,
  WELL_BUBBLE_SPEED_MAX,
  WELL_BUBBLE_SPEED_MIN,
} from '../../../config/constants.js';

type WellGeometry = {
  enabled: boolean;
  canvasWidth: number;
  groundY: number;
  centerX: number;
  openingLeft: number;
  openingRight: number;
  innerLeft: number;
  innerRight: number;
  wallThickness: number;
  waterSurfaceY: number;
  bottomY: number;
};

const DEFAULT_GEOMETRY: WellGeometry = {
  enabled: false,
  canvasWidth: 0,
  groundY: 0,
  centerX: 0,
  openingLeft: 0,
  openingRight: 0,
  innerLeft: 0,
  innerRight: 0,
  wallThickness: WELL_WALL_THICKNESS,
  waterSurfaceY: 0,
  bottomY: 0,
};

const geometry: WellGeometry = { ...DEFAULT_GEOMETRY };

let anchorX: number | null = null;

type Bubble = {
  anchorX: number;
  worldY: number;
  radius: number;
  riseSpeed: number;
  wobblePhase: number;
  wobbleSpeed: number;
  wobbleAmplitude: number;
};

const bubbles: Bubble[] = [];
let bubbleSpawnAccumulator = 0;

function resetBubbles(): void {
  bubbles.length = 0;
  bubbleSpawnAccumulator = 0;

  if (!geometry.enabled) return;

  const initialCount = Math.min(6, WELL_BUBBLE_MAX_COUNT);
  for (let i = 0; i < initialCount; i++) {
    const bubble = createBubble(true);
    if (bubble) bubbles.push(bubble);
  }
}

function createBubble(seed = false): Bubble | null {
  if (!geometry.enabled) return null;

  const usableWidth = geometry.innerRight - geometry.innerLeft;
  if (usableWidth <= 0) return null;

  const large = Math.random() < WELL_BUBBLE_LARGE_CHANCE;
  const radius = large
    ? WELL_BUBBLE_LARGE_RADIUS
    : WELL_BUBBLE_MIN_RADIUS + Math.random() * (WELL_BUBBLE_MAX_RADIUS - WELL_BUBBLE_MIN_RADIUS);

  const clampedRadius = Math.min(radius, usableWidth / 2);
  const margin = Math.max(clampedRadius, WELL_WALL_THICKNESS);
  const span = Math.max(usableWidth - clampedRadius * 2, 1);
  const anchorX = geometry.innerLeft + margin + Math.random() * span;

  const waterTop = geometry.waterSurfaceY;
  const bottom = geometry.bottomY;
  const verticalSpan = Math.max(bottom - waterTop - clampedRadius * 2, 1);
  const baseY = seed
    ? waterTop + clampedRadius + Math.random() * verticalSpan
    : bottom - clampedRadius - Math.random() * (verticalSpan * 0.3 + 80);

  const wobbleSpeed = 1 + Math.random() * 1.5;
  const wobbleAmplitude = Math.max(2, clampedRadius * (0.12 + Math.random() * 0.2));
  const riseSpeed = WELL_BUBBLE_SPEED_MIN + Math.random() * (WELL_BUBBLE_SPEED_MAX - WELL_BUBBLE_SPEED_MIN);

  return {
    anchorX,
    worldY: baseY,
    radius: clampedRadius,
    riseSpeed,
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleSpeed,
    wobbleAmplitude,
  };
}

function recomputeGeometry(): void {
  const { canvasWidth, groundY } = geometry;
  if (canvasWidth <= 0 || groundY <= 0) {
    Object.assign(geometry, DEFAULT_GEOMETRY);
    resetBubbles();
    return;
  }

  const halfOpening = WELL_OPENING_WIDTH / 2;
  const margin = halfOpening + WELL_WALL_THICKNESS + 20;
  const desiredCenter = anchorX ?? (canvasWidth - margin);
  const center = clamp(desiredCenter, margin, canvasWidth - margin);

  const openingLeft = center - halfOpening;
  const openingRight = center + halfOpening;
  const innerLeft = openingLeft + WELL_WALL_THICKNESS;
  const innerRight = openingRight - WELL_WALL_THICKNESS;

  geometry.enabled = true;
  geometry.centerX = center;
  geometry.openingLeft = openingLeft;
  geometry.openingRight = openingRight;
  geometry.innerLeft = innerLeft;
  geometry.innerRight = innerRight;
  geometry.wallThickness = WELL_WALL_THICKNESS;
  geometry.waterSurfaceY = groundY + WELL_WATER_SURFACE_OFFSET;
  geometry.bottomY = geometry.waterSurfaceY + WELL_BOTTOM_DEPTH;

  resetBubbles();
}

export function configureWellGeometry(canvasWidth: number, groundY: number): void {
  geometry.canvasWidth = canvasWidth;
  geometry.groundY = groundY;
  recomputeGeometry();
}

export function setWellAnchorX(x: number): void {
  anchorX = x;
  recomputeGeometry();
}

export function getWellGeometry(): Readonly<WellGeometry> {
  return geometry;
}

export function isOverWellOpening(x: number, radius = 0): boolean {
  if (!geometry.enabled) return false;
  return x + radius > geometry.openingLeft && x - radius < geometry.openingRight;
}

export function isInsideWell(x: number, y: number, radius = 0): boolean {
  if (!geometry.enabled) return false;
  if (y + radius < geometry.groundY) return false;
  return x + radius > geometry.innerLeft && x - radius < geometry.innerRight;
}

export function clampXToWell(x: number, radius: number): number {
  if (!geometry.enabled) return x;
  const min = geometry.innerLeft + radius;
  const max = geometry.innerRight - radius;
  return clamp(x, min, max);
}

export function getWaterSurfaceY(): number {
  return geometry.waterSurfaceY;
}

export function getWellBottomY(): number {
  return geometry.bottomY;
}

export function drawWell(ctx: CanvasRenderingContext2D, cameraY: number): void {
  if (!geometry.enabled) return;

  const rimY = geometry.groundY - cameraY;
  const waterSurface = geometry.waterSurfaceY - cameraY;
  const bottomY = geometry.bottomY - cameraY;

  ctx.save();

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = geometry.wallThickness;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(geometry.openingLeft, rimY);
  ctx.lineTo(geometry.openingLeft, bottomY);
  ctx.moveTo(geometry.openingRight, rimY);
  ctx.lineTo(geometry.openingRight, bottomY);
  ctx.stroke();

  ctx.fillStyle = 'rgba(0, 90, 180, 0.18)';
  ctx.fillRect(
    geometry.innerLeft,
    waterSurface,
    geometry.innerRight - geometry.innerLeft,
    Math.max(0, bottomY - waterSurface),
  );

  ctx.strokeStyle = 'rgba(100, 200, 255, 0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(geometry.innerLeft, waterSurface);
  ctx.lineTo(geometry.innerRight, waterSurface);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(geometry.openingLeft - geometry.wallThickness / 2, rimY);
  ctx.lineTo(geometry.openingRight + geometry.wallThickness / 2, rimY);
  ctx.stroke();

  for (const bubble of bubbles) {
    const wobbleX = bubble.anchorX + Math.sin(bubble.wobblePhase) * bubble.wobbleAmplitude;
    const screenY = bubble.worldY - cameraY;
    if (screenY < rimY - bubble.radius * 2 || screenY > bottomY + bubble.radius * 2) continue;
    drawPixelatedBubble(ctx, Math.round(wobbleX), Math.round(screenY), bubble.radius);
  }

  ctx.restore();
}

export function getSwimImpulseRange(): { min: number; max: number } {
  return { min: SWIM_FORCE_MIN, max: SWIM_FORCE_MAX };
}

export function getWaterSpeedLimit(): number {
  return WATER_MAX_SPEED;
}

export function updateWellEnvironment(dt: number): void {
  if (!geometry.enabled) return;

  for (let i = bubbles.length - 1; i >= 0; i--) {
    const bubble = bubbles[i];
    bubble.worldY -= bubble.riseSpeed * dt;
    bubble.wobblePhase += bubble.wobbleSpeed * dt;

    if (bubble.worldY + bubble.radius <= geometry.waterSurfaceY) {
      bubbles.splice(i, 1);
    }
  }

  if (bubbles.length >= WELL_BUBBLE_MAX_COUNT) {
    bubbleSpawnAccumulator = 0;
    return;
  }

  bubbleSpawnAccumulator += WELL_BUBBLE_SPAWN_RATE * dt;
  while (bubbleSpawnAccumulator >= 1 && bubbles.length < WELL_BUBBLE_MAX_COUNT) {
    const bubble = createBubble();
    if (!bubble) break;
    bubbles.push(bubble);
    bubbleSpawnAccumulator -= 1;
  }

  if (bubbleSpawnAccumulator > 0.4 && bubbles.length < WELL_BUBBLE_MAX_COUNT) {
    if (Math.random() < bubbleSpawnAccumulator) {
      const bubble = createBubble();
      if (bubble) {
        bubbles.push(bubble);
        bubbleSpawnAccumulator = 0;
      }
    }
  }
}

const BUBBLE_PIXEL_SIZE = 2;

function drawPixelatedBubble(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
): void {
  const diameter = radius * 2;
  const gridSize = Math.ceil(diameter / BUBBLE_PIXEL_SIZE);
  const startX = cx - radius;
  const startY = cy - radius;

  ctx.fillStyle = '#ffffff';

  for (let row = 0; row <= gridSize; row++) {
    for (let col = 0; col <= gridSize; col++) {
      const x = startX + col * BUBBLE_PIXEL_SIZE;
      const y = startY + row * BUBBLE_PIXEL_SIZE;

      const dx = (x + BUBBLE_PIXEL_SIZE / 2) - cx;
      const dy = (y + BUBBLE_PIXEL_SIZE / 2) - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= radius - BUBBLE_PIXEL_SIZE * 1.4 && dist <= radius + BUBBLE_PIXEL_SIZE * 0.6) {
        ctx.fillRect(Math.round(x), Math.round(y), BUBBLE_PIXEL_SIZE, BUBBLE_PIXEL_SIZE);
      }
    }
  }

  const trailCount = Math.max(1, Math.min(5, Math.floor(radius / 8)));
  for (let i = 1; i <= trailCount; i++) {
    const offset = radius + i * (BUBBLE_PIXEL_SIZE * 3);
    const trailRadius = Math.max(2, radius * (0.15 - i * 0.02));
    const trailGrid = Math.ceil((trailRadius * 2) / BUBBLE_PIXEL_SIZE);
    const trailY = cy + offset;
    const wobble = Math.sin((i + cx + cy) * 0.2) * (radius * 0.08);

    for (let row = 0; row <= trailGrid; row++) {
      for (let col = 0; col <= trailGrid; col++) {
        const x = cx + wobble - trailRadius + col * BUBBLE_PIXEL_SIZE;
        const y = trailY - trailRadius + row * BUBBLE_PIXEL_SIZE;
        const dx = (x + BUBBLE_PIXEL_SIZE / 2) - (cx + wobble);
        const dy = (y + BUBBLE_PIXEL_SIZE / 2) - trailY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= trailRadius) {
          ctx.fillRect(Math.round(x), Math.round(y), BUBBLE_PIXEL_SIZE, BUBBLE_PIXEL_SIZE);
        }
      }
    }
  }
}
