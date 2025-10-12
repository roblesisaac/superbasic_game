import { clamp } from '../../../utils/utils.js';
import {
  SWIM_FORCE_MAX,
  SWIM_FORCE_MIN,
  WATER_MAX_SPEED,
  WELL_BOTTOM_DEPTH,
  WELL_OPENING_MAX_WIDTH,
  WELL_OPENING_MIN_WIDTH,
  WELL_WALL_THICKNESS,
  WELL_WATER_SURFACE_OFFSET,
} from '../../../config/constants.js';

type WellGeometry = {
  enabled: boolean;
  canvasWidth: number;
  groundY: number;
  centerX: number;
  openingWidth: number;
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
  openingWidth: 0,
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

function recomputeGeometry(): void {
  const { canvasWidth, groundY } = geometry;
  if (canvasWidth <= 0 || groundY <= 0) {
    Object.assign(geometry, DEFAULT_GEOMETRY);
    return;
  }

  const rawOpening = clamp(canvasWidth * 0.22, WELL_OPENING_MIN_WIDTH, WELL_OPENING_MAX_WIDTH);
  const margin = rawOpening / 2 + WELL_WALL_THICKNESS + 16;
  const center = clamp(anchorX ?? (canvasWidth - rawOpening / 2 - 48), margin, canvasWidth - margin);
  const openingLeft = center - rawOpening / 2;
  const openingRight = center + rawOpening / 2;
  const innerLeft = openingLeft + WELL_WALL_THICKNESS;
  const innerRight = openingRight - WELL_WALL_THICKNESS;

  geometry.enabled = true;
  geometry.centerX = center;
  geometry.openingWidth = rawOpening;
  geometry.openingLeft = openingLeft;
  geometry.openingRight = openingRight;
  geometry.innerLeft = innerLeft;
  geometry.innerRight = innerRight;
  geometry.wallThickness = WELL_WALL_THICKNESS;
  geometry.waterSurfaceY = groundY + WELL_WATER_SURFACE_OFFSET;
  geometry.bottomY = geometry.waterSurfaceY + WELL_BOTTOM_DEPTH;
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

  // Draw shaft walls
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = geometry.wallThickness;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(geometry.openingLeft, rimY);
  ctx.lineTo(geometry.openingLeft, bottomY);
  ctx.moveTo(geometry.openingRight, rimY);
  ctx.lineTo(geometry.openingRight, bottomY);
  ctx.stroke();

  // Fill water volume
  ctx.fillStyle = 'rgba(0, 90, 180, 0.18)';
  ctx.fillRect(
    geometry.innerLeft,
    waterSurface,
    geometry.innerRight - geometry.innerLeft,
    bottomY - waterSurface,
  );

  // Draw water surface waves
  ctx.strokeStyle = 'rgba(80, 200, 255, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const waveWidth = 16;
  const waveHeight = 4;
  let x = geometry.innerLeft;
  let flip = false;
  ctx.moveTo(x, waterSurface);
  while (x <= geometry.innerRight) {
    const nextX = Math.min(x + waveWidth, geometry.innerRight);
    const midX = (x + nextX) / 2;
    const peakY = waterSurface + (flip ? -waveHeight : waveHeight);
    ctx.quadraticCurveTo(midX, peakY, nextX, waterSurface);
    x = nextX;
    flip = !flip;
  }
  ctx.stroke();

  // Draw rim highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(geometry.openingLeft - geometry.wallThickness / 2, rimY);
  ctx.lineTo(geometry.openingRight + geometry.wallThickness / 2, rimY);
  ctx.stroke();

  ctx.restore();
}

export function getSwimImpulseRange(): { min: number; max: number } {
  return { min: SWIM_FORCE_MIN, max: SWIM_FORCE_MAX };
}

export function getWaterSpeedLimit(): number {
  return WATER_MAX_SPEED;
}
