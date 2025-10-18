import { clamp } from '../../../utils/utils.js';
import {
  getWellExpansionSpan,
  getWellExpansionTopY,
  getWellShaftSpan,
  getWellWaterSurfaceY,
  type WellBounds
} from './well_layout.js';

interface StaticBubble {
  x: number;
  worldY: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

interface RisingBubble {
  baseX: number;
  worldY: number;
  radius: number;
  speed: number;
  wobbleAmplitude: number;
  wobbleSpeed: number;
  wobblePhase: number;
  opacity: number;
}

export interface BubbleEnvironment {
  timestamp: number;
  cameraY: number;
  canvasHeight: number;
  canvasWidth: number;
  groundY: number;
  wellBounds: WellBounds;
}

const STATIC_SEGMENT_HEIGHT = 96;
const STATIC_DENSITY = 0.00035; // bubbles per pixel in a segment
const STATIC_MIN_PER_SEGMENT = 6;

const RISING_SPAWN_RATE = 2.4; // bubbles per second
const MAX_RISING_BUBBLES = 24;
const RISING_BASE_SPEED = 28; // pixels per second
const RISING_SPEED_VARIANCE = 22;

const RISING_RADIUS_MIN = 3;
const RISING_RADIUS_MAX = 7;

const WALL_MARGIN = 6;

let staticBubbles: StaticBubble[] = [];
let risingBubbles: RisingBubble[] = [];
let staticCoverageBottom = 0;
let lastTimestamp = 0;
let spawnAccumulator = 0;

function interiorSpanForY(worldY: number, env: BubbleEnvironment) {
  const expansionTop = getWellExpansionTopY(env.groundY, env.canvasHeight);
  let left: number;
  let right: number;
  if (worldY <= expansionTop) {
    const span = getWellShaftSpan(env.wellBounds);
    left = span.interiorLeft + WALL_MARGIN;
    right = span.interiorRight - WALL_MARGIN;
    if (right <= left) {
      left = span.interiorLeft;
      right = span.interiorRight;
    }
    return { left, right };
  }

  const span = getWellExpansionSpan(env.canvasWidth);
  left = span.interiorLeft + WALL_MARGIN;
  right = span.interiorRight - WALL_MARGIN;
  if (right <= left) {
    left = span.interiorLeft;
    right = span.interiorRight;
  }
  return { left, right };
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function ensureStaticCoverage(env: BubbleEnvironment, waterSurfaceY: number, requiredBottom: number): void {
  if (requiredBottom <= waterSurfaceY) return;

  if (staticCoverageBottom <= waterSurfaceY) {
    staticCoverageBottom = waterSurfaceY;
  }

  while (staticCoverageBottom < requiredBottom) {
    const segmentTop = staticCoverageBottom;
    const segmentBottom = Math.min(segmentTop + STATIC_SEGMENT_HEIGHT, requiredBottom);
    const segmentHeight = segmentBottom - segmentTop;
    const segmentMid = segmentTop + segmentHeight / 2;
    const { left, right } = interiorSpanForY(segmentMid, env);
    const width = Math.max(0, right - left);

    if (width > 4 && segmentHeight > 0) {
      const area = width * segmentHeight;
      const bubbleCount = Math.max(
        STATIC_MIN_PER_SEGMENT,
        Math.round(area * STATIC_DENSITY)
      );

      for (let i = 0; i < bubbleCount; i++) {
        const worldY = segmentTop + Math.random() * segmentHeight;
        const span = interiorSpanForY(worldY, env);
        const spanWidth = Math.max(0, span.right - span.left);
        if (spanWidth <= 2) continue;

        staticBubbles.push({
          x: span.left + Math.random() * spanWidth,
          worldY,
          radius: randomInRange(1.2, 3.2),
          baseAlpha: randomInRange(0.18, 0.32),
          twinkleSpeed: randomInRange(0.4, 0.9),
          twinklePhase: Math.random() * Math.PI * 2
        });
      }
    }

    staticCoverageBottom = segmentBottom;
  }
}

function spawnRisingBubble(env: BubbleEnvironment, waterSurfaceY: number, viewBottom: number): void {
  if (risingBubbles.length >= MAX_RISING_BUBBLES) return;
  if (viewBottom <= waterSurfaceY + 12) return;

  const spawnY = viewBottom + randomInRange(12, 48);
  const span = interiorSpanForY(spawnY, env);
  const spanWidth = Math.max(0, span.right - span.left);
  if (spanWidth <= 4) return;

  const radius = randomInRange(RISING_RADIUS_MIN, RISING_RADIUS_MAX);

  risingBubbles.push({
    baseX: span.left + Math.random() * spanWidth,
    worldY: spawnY,
    radius,
    speed: RISING_BASE_SPEED + Math.random() * RISING_SPEED_VARIANCE,
    wobbleAmplitude: randomInRange(1.5, 6),
    wobbleSpeed: randomInRange(0.8, 1.6),
    wobblePhase: Math.random() * Math.PI * 2,
    opacity: 0
  });
}

function updateRisingBubbles(env: BubbleEnvironment, waterSurfaceY: number, dt: number): void {
  const viewBottom = env.cameraY + env.canvasHeight;

  spawnAccumulator += dt * RISING_SPAWN_RATE;
  while (spawnAccumulator >= 1) {
    spawnRisingBubble(env, waterSurfaceY, viewBottom);
    spawnAccumulator -= 1;
  }
  if (spawnAccumulator > 0 && Math.random() < spawnAccumulator) {
    spawnRisingBubble(env, waterSurfaceY, viewBottom);
    spawnAccumulator = 0;
  }

  for (let i = risingBubbles.length - 1; i >= 0; i--) {
    const bubble = risingBubbles[i];
    bubble.worldY -= bubble.speed * dt;
    bubble.wobblePhase += bubble.wobbleSpeed * dt;
    bubble.opacity = clamp(bubble.opacity + dt * 1.2, 0, 1);

    if (bubble.worldY - bubble.radius <= waterSurfaceY) {
      risingBubbles.splice(i, 1);
      continue;
    }

    if (bubble.worldY + bubble.radius < env.cameraY - 64) {
      risingBubbles.splice(i, 1);
    }
  }
}

export function updateBubbleField(env: BubbleEnvironment): void {
  const waterSurfaceY = getWellWaterSurfaceY(env.groundY, env.canvasHeight);
  const requiredBottom = env.cameraY + env.canvasHeight * 1.5;

  ensureStaticCoverage(env, waterSurfaceY, requiredBottom);

  const timestamp = env.timestamp;
  if (!Number.isFinite(timestamp)) return;

  if (lastTimestamp === 0) {
    lastTimestamp = timestamp;
    return;
  }

  const dt = clamp((timestamp - lastTimestamp) / 1000, 0, 0.2);
  lastTimestamp = timestamp;

  updateRisingBubbles(env, waterSurfaceY, dt);
}

export function drawBubbleField(ctx: CanvasRenderingContext2D, env: BubbleEnvironment): void {
  const waterSurfaceY = getWellWaterSurfaceY(env.groundY, env.canvasHeight);
  const timestamp = env.timestamp;
  const timeSeconds = Number.isFinite(timestamp) ? timestamp / 1000 : 0;

  ctx.save();

  for (const bubble of staticBubbles) {
    if (bubble.worldY <= waterSurfaceY) continue;
    const screenY = bubble.worldY - env.cameraY;
    if (screenY < -32 || screenY > env.canvasHeight + 32) continue;

    const twinkle = 1 + Math.sin(timeSeconds * bubble.twinkleSpeed + bubble.twinklePhase) * 0.35;
    const alpha = clamp(bubble.baseAlpha * twinkle, 0.05, 0.45);
    const size = Math.max(1, Math.round(bubble.radius * 2));
    const screenX = Math.round(bubble.x - size / 2);
    const screenTop = Math.round(screenY - size / 2);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#7fc8ff';
    ctx.fillRect(screenX, screenTop, size, size);
  }

  ctx.globalAlpha = 1;

  for (const bubble of risingBubbles) {
    if (bubble.worldY <= waterSurfaceY) continue;
    const screenY = bubble.worldY - env.cameraY;
    if (screenY < -32 || screenY > env.canvasHeight + 64) continue;

    const wobble = Math.sin(bubble.wobblePhase) * bubble.wobbleAmplitude;
    const drawX = Math.round(bubble.baseX + wobble);
    const size = Math.max(3, Math.round(bubble.radius * 2));
    const half = Math.round(size / 2);
    const drawY = Math.round(screenY);

    ctx.globalAlpha = 0.55 * bubble.opacity;
    ctx.fillStyle = '#9cd8ff';
    ctx.fillRect(drawX - half, drawY - half, size, size);

    const innerSize = Math.max(1, size - 2);
    ctx.globalAlpha = 0.85 * bubble.opacity;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(drawX - Math.floor(innerSize / 2), drawY - Math.floor(innerSize / 2), innerSize, innerSize);
  }

  ctx.restore();
}

export function resetBubbleField(): void {
  staticBubbles = [];
  risingBubbles = [];
  staticCoverageBottom = 0;
  lastTimestamp = 0;
  spawnAccumulator = 0;
}
