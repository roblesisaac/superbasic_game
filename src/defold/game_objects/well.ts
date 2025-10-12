import { SPRITE_SIZE, CAM_BOTTOM } from '../../config/constants.js';
import { canvasWidth, canvasHeight, groundY } from '../runtime/state/rendering_state.js';
import type { Sprite } from './sprite.js';

const SPRITE_RADIUS = SPRITE_SIZE / 2;

const WELL_TOP_WIDTH = 98;
const WELL_WALL_THICKNESS = 8;
const WELL_AIR_GAP = 120;
const WELL_NARROW_DEPTH = 260;
const WELL_BOTTOM_EXTRA = 1400;

const MIN_SMALL_BUBBLE_SIZE = SPRITE_RADIUS * 0.6;
const MAX_SMALL_BUBBLE_SIZE = SPRITE_RADIUS * 1.2;
const LARGE_BUBBLE_SIZE = SPRITE_RADIUS * 1.8;
const LARGE_BUBBLE_CHANCE = 0.06;
const MAX_BUBBLES = 22;
const BUBBLE_ASCENT_SPEED_MIN = 32;
const BUBBLE_ASCENT_SPEED_MAX = 68;

const OXYGEN_MAX = 30;
const OXYGEN_DEPLETION_PER_SEC = 1;
const OXYGEN_RECHARGE_PER_SEC = 2;
const BUBBLE_SHRINK_RATE = 9;
const BUBBLE_ABSORB_RATE = 0.45;

const WATER_UPWARD_DRIFT = 4.8;
const WATER_FRICTION = 0.96;
const WATER_RESISTANCE = 0.88;
const WATER_MAX_SPEED = 360;

type WellGeometry = {
  topY: number;
  narrowBottomY: number;
  waterSurfaceY: number;
  bottomY: number;
  topLeftX: number;
  topRightX: number;
  bottomLeftX: number;
  bottomRightX: number;
  wallThickness: number;
};

type Bubble = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  active: boolean;
};

type OccupantState = {
  inWell: boolean;
  inWater: boolean;
  depth: number;
  oxygen: number;
  bubbleRadius: number;
  inBubble: boolean;
};

type WellState = {
  geometry: WellGeometry;
  bubbles: Bubble[];
  occupant: OccupantState;
  dashToggle: number;
  lastDashSwitch: number;
  lastSpawnAccumulator: number;
};

const wellState: WellState = {
  geometry: {
    topY: groundY,
    narrowBottomY: groundY + WELL_NARROW_DEPTH,
    waterSurfaceY: groundY + WELL_NARROW_DEPTH + WELL_AIR_GAP,
    bottomY: groundY + WELL_NARROW_DEPTH + WELL_AIR_GAP + WELL_BOTTOM_EXTRA,
    topLeftX: 0,
    topRightX: 0,
    bottomLeftX: 0,
    bottomRightX: 0,
    wallThickness: WELL_WALL_THICKNESS,
  },
  bubbles: [],
  occupant: {
    inWell: false,
    inWater: false,
    depth: 0,
    oxygen: OXYGEN_MAX,
    bubbleRadius: 0,
    inBubble: false,
  },
  dashToggle: 0,
  lastDashSwitch: performance.now(),
  lastSpawnAccumulator: 0,
};

function computeHeartAnchorX(): number {
  const heartWidth = 24; // Pixel heart width when spawned on ground (pixelSize 3)
  const offsetFromEdge = 20;
  const heartLeft = canvasWidth - heartWidth - offsetFromEdge;
  return heartLeft + heartWidth / 2;
}

function updateGeometry(): void {
  const anchorX = computeHeartAnchorX();
  const halfTop = WELL_TOP_WIDTH / 2;
  const margin = WELL_WALL_THICKNESS + 6;
  const maxLeft = canvasWidth - margin - WELL_TOP_WIDTH;
  const clampedCenter = Math.max(margin + halfTop, Math.min(anchorX, maxLeft + halfTop));
  const topLeftX = Math.max(margin, Math.min(clampedCenter - halfTop, maxLeft));
  const topRightX = topLeftX + WELL_TOP_WIDTH;

  const bottomLeftX = WELL_WALL_THICKNESS;
  const bottomRightX = canvasWidth - WELL_WALL_THICKNESS;

  wellState.geometry = {
    topY: groundY,
    narrowBottomY: groundY + WELL_NARROW_DEPTH,
    waterSurfaceY: groundY + WELL_NARROW_DEPTH + WELL_AIR_GAP,
    bottomY: groundY + WELL_NARROW_DEPTH + WELL_AIR_GAP + WELL_BOTTOM_EXTRA,
    topLeftX,
    topRightX,
    bottomLeftX,
    bottomRightX,
    wallThickness: WELL_WALL_THICKNESS,
  };
}

function interpolateWalls(y: number): { left: number; right: number } {
  const { topY, narrowBottomY, bottomY, topLeftX, topRightX, bottomLeftX, bottomRightX } =
    wellState.geometry;

  if (y <= narrowBottomY) {
    return { left: topLeftX, right: topRightX };
  }

  const t = Math.min(1, Math.max(0, (y - narrowBottomY) / Math.max(1, bottomY - narrowBottomY)));
  const left = topLeftX + (bottomLeftX - topLeftX) * t;
  const right = topRightX + (bottomRightX - topRightX) * t;
  return { left, right };
}

function createBubble(): Bubble {
  const { waterSurfaceY, bottomY } = wellState.geometry;
  const depthRange = Math.max(60, bottomY - waterSurfaceY - 60);
  const spawnY = bottomY - Math.random() * depthRange;
  const walls = interpolateWalls(spawnY);
  const padding = WELL_WALL_THICKNESS + SPRITE_RADIUS;
  const x = Math.min(walls.right - padding, Math.max(walls.left + padding, walls.left + Math.random() * (walls.right - walls.left)));
  const isLarge = Math.random() < LARGE_BUBBLE_CHANCE;
  const radius = isLarge
    ? LARGE_BUBBLE_SIZE
    : MIN_SMALL_BUBBLE_SIZE + Math.random() * (MAX_SMALL_BUBBLE_SIZE - MIN_SMALL_BUBBLE_SIZE);
  const speed = BUBBLE_ASCENT_SPEED_MIN + Math.random() * (BUBBLE_ASCENT_SPEED_MAX - BUBBLE_ASCENT_SPEED_MIN);

  return { x, y: spawnY, radius, speed, active: true };
}

function ensureBubbleCount(dt: number): void {
  const bubbles = wellState.bubbles;
  if (bubbles.length >= MAX_BUBBLES) return;

  const frames = dt * 60;
  const spawnChancePerFrame = 0.02;
  const probability = 1 - Math.pow(1 - spawnChancePerFrame, Math.max(0, frames));
  if (Math.random() < probability) {
    bubbles.push(createBubble());
  }
}

function updateBubbles(dt: number, sprite: Sprite | null): void {
  const { waterSurfaceY } = wellState.geometry;
  const spriteRadius = SPRITE_RADIUS;
  const spriteX = sprite?.x ?? 0;
  const spriteY = sprite?.y ?? 0;
  const occupant = wellState.occupant;

  for (const bubble of wellState.bubbles) {
    if (!bubble.active) continue;
    bubble.y -= bubble.speed * dt;
    if (bubble.y - bubble.radius <= waterSurfaceY) {
      bubble.active = false;
      continue;
    }

    if (!sprite || !occupant.inWater) continue;

    const dx = bubble.x - spriteX;
    const dy = bubble.y - spriteY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!occupant.inBubble && bubble.radius > spriteRadius && dist < bubble.radius) {
      occupant.inBubble = true;
      occupant.bubbleRadius = bubble.radius;
      bubble.active = false;
      continue;
    }

    if (dist < spriteRadius + bubble.radius) {
      occupant.oxygen = Math.min(OXYGEN_MAX, occupant.oxygen + OXYGEN_RECHARGE_PER_SEC * dt * 4);
      bubble.active = false;
    }

    if (occupant.inBubble && bubble.active) {
      const combined = occupant.bubbleRadius + bubble.radius;
      if (dist < combined) {
        occupant.bubbleRadius += bubble.radius * BUBBLE_ABSORB_RATE;
        bubble.active = false;
      }
    }
  }

  for (let i = wellState.bubbles.length - 1; i >= 0; i--) {
    if (!wellState.bubbles[i].active) {
      wellState.bubbles.splice(i, 1);
    }
  }
}

function applyWaterPhysics(sprite: Sprite, dt: number): void {
  const frames = dt * 60;
  const friction = Math.pow(WATER_FRICTION, frames);
  const resistance = Math.pow(WATER_RESISTANCE, frames);
  sprite.vx *= friction * resistance;
  sprite.vy *= friction * resistance;
  sprite.vy -= WATER_UPWARD_DRIFT * dt;

  const speed = Math.hypot(sprite.vx, sprite.vy);
  if (speed > WATER_MAX_SPEED) {
    const scale = WATER_MAX_SPEED / speed;
    sprite.vx *= scale;
    sprite.vy *= scale;
  }
}

function clampSpriteToWell(sprite: Sprite): void {
  const radius = SPRITE_RADIUS;
  const bounds = interpolateWalls(sprite.y);
  const padding = wellState.geometry.wallThickness * 0.5;

  if (sprite.x - radius < bounds.left + padding) {
    sprite.x = bounds.left + padding + radius;
    if (sprite.vx < 0) sprite.vx = 0;
  }
  if (sprite.x + radius > bounds.right - padding) {
    sprite.x = bounds.right - padding - radius;
    if (sprite.vx > 0) sprite.vx = 0;
  }

  const { bottomY } = wellState.geometry;
  if (sprite.y + radius > bottomY) {
    sprite.y = bottomY - radius;
    if (sprite.vy > 0) sprite.vy = 0;
  }
}

export function initializeWell(): void {
  updateGeometry();
  wellState.bubbles = [];
  for (let i = 0; i < 6; i++) {
    wellState.bubbles.push(createBubble());
  }
  wellState.occupant = {
    inWell: false,
    inWater: false,
    depth: 0,
    oxygen: OXYGEN_MAX,
    bubbleRadius: 0,
    inBubble: false,
  };
  wellState.lastDashSwitch = performance.now();
  wellState.dashToggle = 0;
  wellState.lastSpawnAccumulator = 0;
}

export function isSpriteAboveWellOpening(x: number, radius: number): boolean {
  updateGeometry();
  const { topLeftX, topRightX } = wellState.geometry;
  const leftEdge = x - radius;
  const rightEdge = x + radius;
  return rightEdge > topLeftX && leftEdge < topRightX;
}

function updateOccupant(sprite: Sprite | null, dt: number): void {
  const occupant = wellState.occupant;
  occupant.inWell = false;
  occupant.inWater = false;
  occupant.depth = 0;

  if (!sprite) return;

  const radius = SPRITE_RADIUS;
  const { topY, waterSurfaceY } = wellState.geometry;
  const bounds = interpolateWalls(sprite.y);
  const leftEdge = sprite.x - radius;
  const rightEdge = sprite.x + radius;

  const insideHorizontal = rightEdge > bounds.left && leftEdge < bounds.right;
  const belowTop = sprite.y + radius >= topY - 1;

  if (!insideHorizontal || !belowTop) {
    occupant.inBubble = false;
    occupant.bubbleRadius = 0;
    occupant.oxygen = Math.min(OXYGEN_MAX, occupant.oxygen + OXYGEN_RECHARGE_PER_SEC * dt);
    return;
  }

  occupant.inWell = true;
  clampSpriteToWell(sprite);

  const submerged = sprite.y - radius >= waterSurfaceY;
  occupant.inWater = submerged;
  occupant.depth = submerged ? sprite.y - waterSurfaceY : 0;

  if (submerged) {
    applyWaterPhysics(sprite, dt);
  }

  if (occupant.inBubble) {
    occupant.bubbleRadius = Math.max(radius + 4, occupant.bubbleRadius - BUBBLE_SHRINK_RATE * dt);
    if (occupant.bubbleRadius <= radius + 4) {
      occupant.inBubble = false;
      occupant.bubbleRadius = 0;
    }
  }

  if (submerged) {
    if (!occupant.inBubble) {
      occupant.oxygen = Math.max(0, occupant.oxygen - OXYGEN_DEPLETION_PER_SEC * dt);
    } else {
      occupant.oxygen = Math.min(OXYGEN_MAX, occupant.oxygen + OXYGEN_RECHARGE_PER_SEC * dt);
    }
  } else {
    occupant.oxygen = Math.min(OXYGEN_MAX, occupant.oxygen + OXYGEN_RECHARGE_PER_SEC * dt);
  }
}

export function updateWell(dt: number, sprite: Sprite | null): void {
  updateGeometry();

  updateOccupant(sprite, dt);
  updateBubbles(dt, sprite);
  ensureBubbleCount(dt);

  const now = performance.now();
  if (now - wellState.lastDashSwitch > 900) {
    wellState.dashToggle = (wellState.dashToggle + 1) % 2;
    wellState.lastDashSwitch = now;
  }
}

export function getWellState(): Readonly<WellState> {
  updateGeometry();
  return wellState;
}

export function getWellCameraBounds(): { maxDownward: number } {
  updateGeometry();
  const { bottomY } = wellState.geometry;
  const bottomLine = canvasHeight * CAM_BOTTOM;
  const maxDownward = Math.max(0, bottomY - bottomLine);
  return { maxDownward };
}

export function getWellHorizontalBoundsAt(y: number): { left: number; right: number } {
  updateGeometry();
  return interpolateWalls(y);
}

