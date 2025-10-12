import { clamp } from '../../../utils/utils.js';
import {
  SWIM_FORCE_MAX,
  SWIM_FORCE_MIN,
  WATER_MAX_SPEED,
  WELL_BOTTOM_DEPTH,
  WELL_OPENING_WIDTH,
  WELL_WALL_THICKNESS,
  WELL_WATER_SURFACE_OFFSET,
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

function recomputeGeometry(): void {
  const { canvasWidth, groundY } = geometry;
  if (canvasWidth <= 0 || groundY <= 0) {
    Object.assign(geometry, DEFAULT_GEOMETRY);
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

  ctx.restore();
}

export function getSwimImpulseRange(): { min: number; max: number } {
  return { min: SWIM_FORCE_MIN, max: SWIM_FORCE_MAX };
}

export function getWaterSpeedLimit(): number {
  return WATER_MAX_SPEED;
}
