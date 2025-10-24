import { clamp } from "../../shared/utils.js";
import { SMALL_BUBBLE_OXYGEN_MULTIPLIER } from "../../config/constants.js";
import {
  getWellExpansionSpan,
  getWellExpansionTopY,
  getWellShaftSpan,
  getWellWaterSurfaceY,
  type WellBounds,
} from "./well_layout.js";

interface StaticBubble {
  x: number;
  worldY: number;
  brightness: number;
}

interface BubbleTrail {
  x: number;
  worldY: number;
  life: number;
  patternIndex: number;
  offsetX: number;
}

interface RisingBubble {
  x: number;
  worldY: number;
  radius: number;
  speed: number;
  trailSpacingFrames: number;
  trailCounter: number;
  trail: BubbleTrail[];
}

export interface SpriteBubbleCollisionContext {
  x: number;
  y: number;
  spriteRadius: number;
  isInBubble: boolean;
  bubbleRadius: number;
  inWater: boolean;
  waterSurfaceY: number;
}

export interface SpriteBubbleCollisionResult {
  oxygenDelta: number;
  inBubble: boolean;
  bubbleRadius: number;
}

export interface BubbleEnvironment {
  timestamp: number;
  cameraY: number;
  canvasHeight: number;
  canvasWidth: number;
  groundY: number;
  wellBounds: WellBounds;
}

const STATIC_SEGMENT_HEIGHT = 100;
const STATIC_BUBBLES_PER_SEGMENT = 5;
const STATIC_PIXEL_SIZE = 4;

const MIN_SMALL_BUBBLE_RADIUS = 10;
const MAX_SMALL_BUBBLE_RADIUS = 18;
const LARGE_BUBBLE_RADIUS = 26;
const LARGE_BUBBLE_CHANCE = 0.05;
const MAX_RISING_BUBBLES = 20;
const INITIAL_RISING_BUBBLES = 8;
const RISING_BUBBLE_SPAWNS_PER_SECOND = 1; // Number of rising bubbles to spawn each second
const BUBBLE_MIN_SPEED = 0.5 * 1.5 * 60;
const BUBBLE_MAX_SPEED = 1.5 * 1.5 * 60;
const TRAIL_PIXEL_SIZE = 4;
const TRAIL_HORIZONTAL_JITTER = 8;

type BubblePatternCell = 0 | 1 | 2;

const bubblePattern: ReadonlyArray<ReadonlyArray<BubblePatternCell>> = [
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
  [0, 1, 2, 2, 0, 0, 0, 0, 1, 0],
  [1, 0, 2, 2, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
  [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
];

const trailPatterns: ReadonlyArray<ReadonlyArray<ReadonlyArray<number>>> = [
  [
    [0, 1, 0],
    [1, 0, 1],
    [0, 1, 0],
  ],
  [
    [1, 1],
    [1, 1],
  ],
  [[1]],
];

const BUBBLE_BASE_COLOR = "#689fda";
const BUBBLE_HIGHLIGHT_COLOR = "rgba(104, 159, 218, 0.6)";

let staticBubbles: StaticBubble[] = [];
let risingBubbles: RisingBubble[] = [];
let lastStaticSegmentBottom = 0;
let lastTimestamp = 0;
let spawnTimer = 0;
let seededInitialBubbles = false;

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function interiorSpanForY(worldY: number, env: BubbleEnvironment) {
  const expansionTop = getWellExpansionTopY(env.groundY, env.canvasHeight);
  if (worldY <= expansionTop) {
    const span = getWellShaftSpan(env.wellBounds);
    return {
      left: span.interiorLeft,
      right: span.interiorRight,
    };
  }

  const expansionSpan = getWellExpansionSpan(env.canvasWidth);
  return {
    left: expansionSpan.interiorLeft,
    right: expansionSpan.interiorRight,
  };
}

function ensureStaticBubbles(
  env: BubbleEnvironment,
  waterSurfaceY: number,
  viewBottom: number,
): void {
  if (viewBottom <= waterSurfaceY) {
    return;
  }

  if (lastStaticSegmentBottom < waterSurfaceY) {
    lastStaticSegmentBottom = waterSurfaceY;
  }

  while (lastStaticSegmentBottom < viewBottom) {
    const segmentTop = lastStaticSegmentBottom;
    const segmentBottom = segmentTop + STATIC_SEGMENT_HEIGHT;
    for (let i = 0; i < STATIC_BUBBLES_PER_SEGMENT; i++) {
      const worldY = segmentTop + Math.random() * STATIC_SEGMENT_HEIGHT;
      const { left, right } = interiorSpanForY(worldY, env);
      const width = Math.max(0, right - left);
      if (width <= 0) {
        continue;
      }

      staticBubbles.push({
        x: left + Math.random() * width,
        worldY,
        brightness: 0.3 + Math.random() * 0.7,
      });
    }

    lastStaticSegmentBottom += STATIC_SEGMENT_HEIGHT;
  }
}

function createRisingBubble(
  env: BubbleEnvironment,
  waterSurfaceY: number,
  viewBottom: number,
): void {
  if (risingBubbles.length >= MAX_RISING_BUBBLES) {
    return;
  }
  if (viewBottom <= waterSurfaceY) {
    return;
  }

  const isLarge = Math.random() < LARGE_BUBBLE_CHANCE;
  const radius = isLarge
    ? LARGE_BUBBLE_RADIUS
    : randomInRange(MIN_SMALL_BUBBLE_RADIUS, MAX_SMALL_BUBBLE_RADIUS);

  const spawnY = viewBottom + radius + 50;
  const { left, right } = interiorSpanForY(spawnY, env);
  const width = Math.max(0, right - left);
  if (width <= 0) {
    return;
  }

  risingBubbles.push({
    x: left + Math.random() * width,
    worldY: spawnY,
    radius,
    speed: randomInRange(BUBBLE_MIN_SPEED, BUBBLE_MAX_SPEED),
    trailSpacingFrames: 15 + Math.random() * 10,
    trailCounter: 0,
    trail: [],
  });
}

function seedInitialRisingBubbles(
  env: BubbleEnvironment,
  waterSurfaceY: number,
): void {
  if (seededInitialBubbles) {
    return;
  }
  seededInitialBubbles = true;

  const viewBottom = env.cameraY + env.canvasHeight;
  for (let i = 0; i < INITIAL_RISING_BUBBLES; i++) {
    createRisingBubble(env, waterSurfaceY, viewBottom);
  }
}

function updateRisingBubbles(
  env: BubbleEnvironment,
  waterSurfaceY: number,
  dt: number,
): void {
  const viewBottom = env.cameraY + env.canvasHeight;

  if (RISING_BUBBLE_SPAWNS_PER_SECOND > 0) {
    const spawnInterval = 1 / RISING_BUBBLE_SPAWNS_PER_SECOND;
    spawnTimer += dt;
    while (spawnTimer >= spawnInterval) {
      createRisingBubble(env, waterSurfaceY, viewBottom);
      spawnTimer -= spawnInterval;
    }
  } else {
    spawnTimer = 0;
  }

  for (let i = risingBubbles.length - 1; i >= 0; i--) {
    const bubble = risingBubbles[i];
    bubble.worldY -= bubble.speed * dt;
    bubble.trailCounter += dt * 60;

    if (bubble.trailCounter > bubble.trailSpacingFrames) {
      bubble.trail.push({
        x: bubble.x,
        worldY: bubble.worldY + bubble.radius + 5,
        life: 1,
        patternIndex: Math.floor(Math.random() * trailPatterns.length),
        offsetX: randomInRange(
          -TRAIL_HORIZONTAL_JITTER,
          TRAIL_HORIZONTAL_JITTER,
        ),
      });
      bubble.trailCounter = 0;
    }

    bubble.trail = bubble.trail.filter((trail) => {
      trail.life -= dt * 1.2;
      return trail.life > 0;
    });

    if (bubble.worldY - bubble.radius < waterSurfaceY) {
      risingBubbles.splice(i, 1);
      continue;
    }

    if (bubble.worldY + bubble.radius < env.cameraY - 64) {
      risingBubbles.splice(i, 1);
    }
  }

  for (let i = 0; i < risingBubbles.length; i++) {
    const bubble = risingBubbles[i];
    for (let j = i + 1; j < risingBubbles.length; j++) {
      const other = risingBubbles[j];
      const dx = bubble.x - other.x;
      const dy = bubble.worldY - other.worldY;
      const dist = Math.hypot(dx, dy);
      if (dist >= bubble.radius + other.radius) {
        continue;
      }

      if (bubble.radius === other.radius) {
        continue;
      }

      let absorber: RisingBubble;
      let absorbedIndex: number;
      if (bubble.radius > other.radius) {
        absorber = bubble;
        absorbedIndex = j;
      } else {
        absorber = other;
        absorbedIndex = i;
      }

      const absorbed = risingBubbles[absorbedIndex];
      const volumeIncrease =
        (absorbed.radius * absorbed.radius) /
        (absorber.radius * absorber.radius);
      absorber.radius += absorbed.radius * 0.4 * volumeIncrease;
      risingBubbles.splice(absorbedIndex, 1);

      if (absorbedIndex === i) {
        i--;
        break;
      }

      if (absorbedIndex < i) {
        i--;
        break;
      }

      j--;
    }
  }
}

function drawPixelatedBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  drawTrail: boolean,
  trail: BubbleTrail[],
  cameraY: number,
): void {
  const patternSize = bubblePattern.length;
  const scale = (radius * 2) / (patternSize * STATIC_PIXEL_SIZE);
  const scaledPixel = STATIC_PIXEL_SIZE * scale;

  for (let row = 0; row < patternSize; row++) {
    for (let col = 0; col < patternSize; col++) {
      const cell = bubblePattern[row][col];
      if (cell === 0) {
        continue;
      }

      ctx.fillStyle = cell === 2 ? BUBBLE_HIGHLIGHT_COLOR : BUBBLE_BASE_COLOR;
      ctx.fillRect(
        x - radius + col * scaledPixel,
        y - radius + row * scaledPixel,
        scaledPixel,
        scaledPixel,
      );
    }
  }

  if (!drawTrail) {
    return;
  }

  for (const t of trail) {
    const screenY = t.worldY - cameraY;
    ctx.fillStyle = `rgba(104, 159, 218, ${t.life})`;
    const trailScale = scale * 0.5;
    const trailPixel = TRAIL_PIXEL_SIZE * trailScale;

    const pattern = trailPatterns[t.patternIndex] ?? trailPatterns[0];
    const patternHeight = pattern.length;
    const patternWidth = pattern[0]?.length ?? 0;
    const originX = t.x + t.offsetX - (patternWidth * trailPixel) / 2;

    for (let row = 0; row < patternHeight; row++) {
      for (let col = 0; col < pattern[row].length; col++) {
        if (pattern[row][col] !== 1) {
          continue;
        }

        ctx.fillRect(
          originX + col * trailPixel,
          screenY + row * trailPixel,
          trailPixel,
          trailPixel,
        );
      }
    }
  }
}

export function handleSpriteBubbleCollisions(
  context: SpriteBubbleCollisionContext,
): SpriteBubbleCollisionResult {
  let inBubble = context.isInBubble;
  let bubbleRadius = context.bubbleRadius;
  let oxygenDelta = 0;

  if (!context.inWater) {
    return { oxygenDelta, inBubble: false, bubbleRadius: 0 };
  }

  const spriteRadius = context.spriteRadius;

  for (let i = risingBubbles.length - 1; i >= 0; i--) {
    const bubble = risingBubbles[i];
    if (bubble.worldY <= context.waterSurfaceY) {
      continue;
    }

    const dx = bubble.x - context.x;
    const dy = bubble.worldY - context.y;
    const dist = Math.hypot(dx, dy);

    if (!inBubble) {
      if (
        bubble.radius <= spriteRadius &&
        dist < bubble.radius + spriteRadius
      ) {
        oxygenDelta += bubble.radius * SMALL_BUBBLE_OXYGEN_MULTIPLIER;
        risingBubbles.splice(i, 1);
        continue;
      }

      if (bubble.radius > spriteRadius && dist < bubble.radius) {
        inBubble = true;
        bubbleRadius = bubble.radius;
        risingBubbles.splice(i, 1);
        continue;
      }
    } else {
      if (dist < bubbleRadius + bubble.radius) {
        const volumeIncrease =
          (bubble.radius * bubble.radius) / (bubbleRadius * bubbleRadius);
        bubbleRadius += bubble.radius * 0.4 * volumeIncrease;
        risingBubbles.splice(i, 1);
      }
    }
  }

  return { oxygenDelta, inBubble, bubbleRadius };
}

export function updateBubbleField(env: BubbleEnvironment): void {
  const waterSurfaceY = getWellWaterSurfaceY(env.groundY, env.canvasHeight);
  const viewBottom = env.cameraY + env.canvasHeight * 2;

  ensureStaticBubbles(env, waterSurfaceY, viewBottom);
  seedInitialRisingBubbles(env, waterSurfaceY);

  const timestamp = env.timestamp;
  if (!Number.isFinite(timestamp)) {
    return;
  }

  if (lastTimestamp === 0) {
    lastTimestamp = timestamp;
    return;
  }

  const dt = clamp((timestamp - lastTimestamp) / 1000, 0, 0.2);
  lastTimestamp = timestamp;

  updateRisingBubbles(env, waterSurfaceY, dt);
}

export function drawBubbleField(
  ctx: CanvasRenderingContext2D,
  env: BubbleEnvironment,
): void {
  const waterSurfaceY = getWellWaterSurfaceY(env.groundY, env.canvasHeight);

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  for (const bubble of staticBubbles) {
    if (bubble.worldY <= waterSurfaceY) {
      continue;
    }
    const screenY = bubble.worldY - env.cameraY;
    if (
      screenY < -STATIC_PIXEL_SIZE ||
      screenY > env.canvasHeight + STATIC_PIXEL_SIZE
    ) {
      continue;
    }

    ctx.fillStyle = `rgba(104, 159, 218, ${bubble.brightness})`;
    ctx.fillRect(bubble.x, screenY, STATIC_PIXEL_SIZE, STATIC_PIXEL_SIZE);
  }

  for (const bubble of risingBubbles) {
    if (bubble.worldY <= waterSurfaceY) {
      continue;
    }
    const screenY = bubble.worldY - env.cameraY;
    if (
      screenY < -bubble.radius ||
      screenY > env.canvasHeight + bubble.radius + 64
    ) {
      continue;
    }

    drawPixelatedBubble(
      ctx,
      Math.round(bubble.x),
      Math.round(screenY),
      bubble.radius,
      true,
      bubble.trail,
      env.cameraY,
    );
  }

  ctx.restore();
}

export function drawEncasingBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  drawPixelatedBubble(ctx, x, y, radius, false, [], 0);
}

export function resetBubbleField(): void {
  staticBubbles = [];
  risingBubbles = [];
  lastStaticSegmentBottom = 0;
  lastTimestamp = 0;
  spawnTimer = 0;
  seededInitialBubbles = false;
}
