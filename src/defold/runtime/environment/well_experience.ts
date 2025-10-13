const WELL_SPRITE_SIZE = 20;
const MIN_SMALL_BUBBLE_SIZE = WELL_SPRITE_SIZE * 0.5;
const MAX_SMALL_BUBBLE_SIZE = WELL_SPRITE_SIZE * 0.9;
const LARGE_BUBBLE_SIZE = WELL_SPRITE_SIZE * 1.3;
const LARGE_BUBBLE_CHANCE = 0.05;
const OXYGEN_DEPLETION_RATE = 1 / 60;
const OXYGEN_RECHARGE_RATE = 2 / 60;
const LAND_GRAVITY = 0.5;
const JUMP_POWER = 12;
const LAND_FRICTION = 0.85;
const WATER_FRICTION = 0.96;
const WATER_RESISTANCE = 0.88;
const POWER_REGEN_LAND = 0.5;
const POWER_REGEN_WATER = 1.2;
const BUBBLE_SPAWN_CHANCE = 0.02;
const MAX_BUBBLES = 20;

const CAMERA_LERP = 0.1;
const MAX_FRAME_SCALE = 3;

export interface WellEntranceRect {
  x: number;
  width: number;
  y: number;
  height: number;
  centerX: number;
}

interface WellDimensions {
  landSurfaceY: number;
  narrowWellDepth: number;
  widenY: number;
  airGap: number;
  waterSurfaceY: number;
  wellX: number;
  wellTopWidth: number;
  wellBottomWidth: number;
  wallThickness: number;
  wellDepth: number;
}

interface BubbleTrail {
  x: number;
  worldY: number;
  life: number;
}

interface Bubble {
  x: number;
  worldY: number;
  radius: number;
  speed: number;
  active: boolean;
  trail: BubbleTrail[];
  trailCounter: number;
  trailSpacing: number;
}

interface UnderwaterStar {
  x: number;
  worldY: number;
  size: number;
  brightness: number;
}

interface PointerState {
  active: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
}

interface WellSprite {
  x: number;
  y: number;
  worldY: number;
  vx: number;
  vy: number;
  size: number;
  maxSpeed: number;
  maxSpeedWater: number;
  inBubble: boolean;
  bubbleRadius: number;
  airDepletionRate: number;
  power: number;
  maxPower: number;
  upwardDrift: number;
  oxygen: number;
  maxOxygen: number;
  onLand: boolean;
  isClimbing: boolean;
}

const bubblePattern = [
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 1, 0, 0, 0, 0, 1, 0],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [0, 1, 0, 0, 0, 0, 1, 0],
  [0, 0, 1, 1, 1, 1, 0, 0]
];

const trailPattern = [
  [1, 1],
  [1, 1]
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeDimensions(width: number, height: number): WellDimensions {
  const landSurfaceY = height / 3;
  const narrowWellDepth = 600;
  const widenY = landSurfaceY + narrowWellDepth;
  const airGap = 150;
  const waterSurfaceY = widenY + airGap;
  const wellTopWidth = clamp(Math.round(width * 0.22), 90, 140);
  const wallMargin = clamp(Math.round(width * 0.12), 70, 120);
  const wellX = clamp(width - wallMargin, wellTopWidth / 2 + 20, width - wellTopWidth / 2 - 20);
  return {
    landSurfaceY,
    narrowWellDepth,
    widenY,
    airGap,
    waterSurfaceY,
    wellX,
    wellTopWidth,
    wellBottomWidth: width,
    wallThickness: 10,
    wellDepth: 2000
  };
}

export function getSurfaceWellRect(canvasWidth: number, groundY: number): WellEntranceRect {
  const width = clamp(Math.round(canvasWidth * 0.16), 70, 120);
  const offsetFromRight = clamp(Math.round(canvasWidth * 0.18), 60, 120);
  const x = canvasWidth - offsetFromRight - width;
  const height = 12;
  return {
    x,
    width,
    y: groundY - height,
    height,
    centerX: x + width / 2
  };
}

function createSprite(dimensions: WellDimensions, rect: WellEntranceRect | null): WellSprite {
  const startX = rect ? rect.centerX : dimensions.wellX;
  return {
    x: startX,
    y: dimensions.landSurfaceY - WELL_SPRITE_SIZE,
    worldY: dimensions.landSurfaceY - WELL_SPRITE_SIZE,
    vx: 0,
    vy: 0,
    size: WELL_SPRITE_SIZE,
    maxSpeed: 8,
    maxSpeedWater: 6,
    inBubble: false,
    bubbleRadius: 0,
    airDepletionRate: 0.15,
    power: 100,
    maxPower: 100,
    upwardDrift: 0.08,
    oxygen: 30,
    maxOxygen: 30,
    onLand: true,
    isClimbing: false
  };
}

export class WellExperience {
  private sprite: WellSprite | null = null;
  private cameraY = 0;
  private pointer: PointerState = {
    active: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0
  };
  private underwaterStars: UnderwaterStar[] = [];
  private bubbles: Bubble[] = [];
  private waterDashOffset = 0;
  private lastWaterToggle = window.performance?.now?.() ?? Date.now();
  private dimensions: WellDimensions | null = null;
  private canvasWidth = 0;
  private canvasHeight = 0;
  private resurfacePending = false;
  private readonly pixelSize = 4;
  private initialized = false;
  private surfaceRect: WellEntranceRect | null = null;

  active = false;

  ensureInitialized(width: number, height: number, rect: WellEntranceRect | null): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.dimensions = computeDimensions(width, height);
    if (rect) this.surfaceRect = rect;

    if (!this.initialized) {
      this.sprite = createSprite(this.dimensions, this.surfaceRect);
      this.underwaterStars = [];
      for (let i = 0; i < 50; i += 1) {
        this.underwaterStars.push({
          x: Math.random() * width,
          worldY: this.dimensions.waterSurfaceY + Math.random() * this.dimensions.wellDepth,
          size: this.pixelSize,
          brightness: 0.3 + Math.random() * 0.7
        });
      }
      this.bubbles = [];
      for (let i = 0; i < 8; i += 1) {
        this.bubbles.push(this.createBubble());
      }
      this.initialized = true;
    } else if (this.dimensions && this.sprite) {
      const rectWidth = this.surfaceRect ? this.surfaceRect.width : this.dimensions.wellTopWidth;
      const centerX = this.surfaceRect ? this.surfaceRect.centerX : this.dimensions.wellX;
      const relativeX = (this.sprite.x - centerX) / rectWidth;
      this.sprite.x = centerX + relativeX * rectWidth;
    }
  }

  enter(width: number, height: number, rect: WellEntranceRect): void {
    this.ensureInitialized(width, height, rect);
    if (!this.sprite || !this.dimensions) return;
    this.active = true;
    this.resurfacePending = false;
    this.pointer.active = false;
    this.cameraY = 0;
    this.sprite.x = rect.centerX;
    this.sprite.worldY = this.dimensions.landSurfaceY - this.sprite.size;
    this.sprite.y = this.sprite.worldY;
    this.sprite.vx = 0;
    this.sprite.vy = 0;
    this.sprite.onLand = true;
    this.sprite.isClimbing = false;
  }

  onPointerStart(x: number, y: number): void {
    this.pointer = { active: true, startX: x, startY: y, x, y };
    if (this.sprite) {
      this.sprite.isClimbing = false;
    }
  }

  onPointerMove(x: number, y: number): void {
    if (!this.pointer.active) return;
    this.pointer.x = x;
    this.pointer.y = y;
  }

  onPointerEnd(): void {
    if (!this.pointer.active) return;
    this.pointer.active = false;
    if (this.sprite) {
      this.sprite.isClimbing = false;
    }
  }

  private ensureDimensions(width: number, height: number, rect: WellEntranceRect): void {
    this.surfaceRect = rect;
    if (width === this.canvasWidth && height === this.canvasHeight && this.dimensions) return;
    this.ensureInitialized(width, height, rect);
  }

  private pointerDelta(): { dx: number; dy: number } {
    if (!this.pointer.active) return { dx: 0, dy: 0 };
    return {
      dx: this.pointer.x - this.pointer.startX,
      dy: this.pointer.y - this.pointer.startY
    };
  }

  private createBubble(): Bubble {
    if (!this.dimensions) throw new Error('Well dimensions missing');
    const isLarge = Math.random() < LARGE_BUBBLE_CHANCE;
    const radius = isLarge
      ? LARGE_BUBBLE_SIZE
      : MIN_SMALL_BUBBLE_SIZE + Math.random() * (MAX_SMALL_BUBBLE_SIZE - MIN_SMALL_BUBBLE_SIZE);
    const x = this.dimensions.wallThickness + Math.random() * (this.canvasWidth - 2 * this.dimensions.wallThickness);
    const worldY = this.cameraY + this.canvasHeight + radius + 50;
    return {
      x,
      worldY,
      radius,
      speed: 0.5 + Math.random(),
      active: true,
      trail: [],
      trailCounter: 0,
      trailSpacing: 15 + Math.random() * 10
    };
  }

  private updateBubbles(frameScale: number): void {
    if (!this.sprite || !this.dimensions) return;

    const inWater = this.sprite.worldY > this.dimensions.waterSurfaceY;
    if (inWater && Math.random() < BUBBLE_SPAWN_CHANCE && this.bubbles.length < MAX_BUBBLES) {
      this.bubbles.push(this.createBubble());
    }

    for (let i = this.bubbles.length - 1; i >= 0; i -= 1) {
      const bubble = this.bubbles[i];
      bubble.worldY -= bubble.speed * 1.5 * frameScale;

      bubble.trailCounter += frameScale;
      if (bubble.trailCounter > bubble.trailSpacing) {
        bubble.trail.push({
          x: bubble.x,
          worldY: bubble.worldY + bubble.radius + 5,
          life: 1
        });
        bubble.trailCounter = 0;
      }

      bubble.trail = bubble.trail.filter((t) => {
        t.life -= 0.02 * frameScale;
        return t.life > 0;
      });

      if (bubble.worldY - bubble.radius < this.dimensions.waterSurfaceY) {
        this.bubbles.splice(i, 1);
        continue;
      }

      if (bubble.active && this.sprite.inBubble === false) {
        const dx = bubble.x - this.sprite.x;
        const dy = bubble.worldY - this.sprite.worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (bubble.radius <= this.sprite.size / 2 && dist < bubble.radius + this.sprite.size / 2) {
          bubble.active = false;
        } else if (bubble.radius > this.sprite.size / 2 && dist < bubble.radius) {
          this.sprite.inBubble = true;
          this.sprite.bubbleRadius = bubble.radius;
          bubble.active = false;
        }
      }

      if (this.sprite.inBubble && bubble.active) {
        const dx = bubble.x - this.sprite.x;
        const dy = bubble.worldY - this.sprite.worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.sprite.bubbleRadius + bubble.radius) {
          const volumeIncrease =
            (bubble.radius * bubble.radius) / (this.sprite.bubbleRadius * this.sprite.bubbleRadius);
          this.sprite.bubbleRadius += bubble.radius * 0.4 * volumeIncrease;
          bubble.active = false;
        }
      }

      if (!bubble.active) continue;

      for (let j = i + 1; j < this.bubbles.length; j += 1) {
        const other = this.bubbles[j];
        if (!other.active) continue;

        const dx = bubble.x - other.x;
        const dy = bubble.worldY - other.worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < bubble.radius + other.radius) {
          if (bubble.radius > other.radius) {
            const volumeIncrease =
              (other.radius * other.radius) / (bubble.radius * bubble.radius);
            bubble.radius += other.radius * 0.4 * volumeIncrease;
            other.active = false;
          } else if (other.radius > bubble.radius) {
            const volumeIncrease =
              (bubble.radius * bubble.radius) / (other.radius * other.radius);
            other.radius += bubble.radius * 0.4 * volumeIncrease;
            bubble.active = false;
          } else if (Math.random() < 0.5) {
            bubble.radius += other.radius * 0.4;
            other.active = false;
          } else {
            other.radius += bubble.radius * 0.4;
            bubble.active = false;
          }
        }
      }
    }

    this.bubbles = this.bubbles.filter((b) => b.active);
  }

  private isTouchingWall(): boolean {
    if (!this.sprite || !this.dimensions) return false;
    if (this.sprite.worldY <= this.dimensions.waterSurfaceY) return false;
    const leftWall = this.dimensions.wallThickness;
    const rightWall = this.canvasWidth - this.dimensions.wallThickness;
    return (
      this.sprite.x - this.sprite.size / 2 <= leftWall ||
      this.sprite.x + this.sprite.size / 2 >= rightWall
    );
  }

  update(dt: number, width: number, height: number, rect: WellEntranceRect): boolean {
    if (!this.active || !this.sprite) return false;
    this.ensureDimensions(width, height, rect);
    if (!this.dimensions) return false;

    const frameScale = clamp(dt * 60, 0, MAX_FRAME_SCALE);
    const pointerActive = this.pointer.active;
    const { dx: dragX, dy: dragY } = this.pointerDelta();

    const inWell =
      this.sprite.x > this.dimensions.wellX - this.dimensions.wellTopWidth / 2 &&
      this.sprite.x < this.dimensions.wellX + this.dimensions.wellTopWidth / 2 &&
      this.sprite.worldY > this.dimensions.landSurfaceY - this.sprite.size;
    const inWater = this.sprite.worldY > this.dimensions.waterSurfaceY;
    this.sprite.onLand = !inWater;

    if (inWater && this.isTouchingWall() && pointerActive) {
      if (dragY < -10) {
        this.sprite.isClimbing = true;
      } else {
        this.sprite.isClimbing = false;
      }
    } else {
      this.sprite.isClimbing = false;
    }

    if (pointerActive) {
      if (this.sprite.power > 0) {
        this.sprite.power -= 1 * frameScale;

        if (this.sprite.onLand) {
          this.sprite.vx -= dragX * 0.015 * frameScale;
          if (dragY > 10 && Math.abs(this.sprite.vy) < 1) {
            this.sprite.vy = -JUMP_POWER;
          }
        } else if (this.sprite.isClimbing) {
          this.sprite.vy -= 0.3 * frameScale;
          this.sprite.vx *= Math.pow(0.9, frameScale);
        } else {
          this.sprite.vx -= dragX * 0.015 * frameScale;
          this.sprite.vy -= dragY * 0.015 * frameScale;
        }
      }
    } else {
      const regenRate = this.sprite.onLand ? POWER_REGEN_LAND : POWER_REGEN_WATER;
      if (this.sprite.power < this.sprite.maxPower) {
        this.sprite.power += regenRate * frameScale;
        if (this.sprite.power > this.sprite.maxPower) this.sprite.power = this.sprite.maxPower;
      }
    }

    if (this.sprite.onLand) {
      this.sprite.vy += LAND_GRAVITY * frameScale;
      this.sprite.vx *= Math.pow(LAND_FRICTION, frameScale);
    } else if (this.sprite.worldY > this.dimensions.waterSurfaceY) {
      if (!this.sprite.isClimbing) {
        this.sprite.vy -= this.sprite.upwardDrift * frameScale;
      }
      this.sprite.vx *= Math.pow(WATER_FRICTION * WATER_RESISTANCE, frameScale);
      this.sprite.vy *= Math.pow(WATER_FRICTION * WATER_RESISTANCE, frameScale);
    } else {
      this.sprite.vy += LAND_GRAVITY * frameScale;
      this.sprite.vx *= Math.pow(LAND_FRICTION, frameScale);
    }

    const maxSpeedLimit = this.sprite.onLand ? this.sprite.maxSpeed : this.sprite.maxSpeedWater;
    const speed = Math.sqrt(this.sprite.vx * this.sprite.vx + this.sprite.vy * this.sprite.vy);
    if (speed > maxSpeedLimit) {
      this.sprite.vx = (this.sprite.vx / speed) * maxSpeedLimit;
      this.sprite.vy = (this.sprite.vy / speed) * maxSpeedLimit;
    }

    this.sprite.x += this.sprite.vx * frameScale;
    this.sprite.worldY += this.sprite.vy * frameScale;

    const overWell =
      this.sprite.x > this.dimensions.wellX - this.dimensions.wellTopWidth / 2 &&
      this.sprite.x < this.dimensions.wellX + this.dimensions.wellTopWidth / 2;

    if (
      this.sprite.worldY + this.sprite.size / 2 < this.dimensions.waterSurfaceY &&
      this.sprite.vy < 0 &&
      !this.sprite.onLand
    ) {
      this.sprite.onLand = false;
    }

    if (
      this.sprite.worldY >= this.dimensions.landSurfaceY - this.sprite.size &&
      !overWell &&
      this.sprite.onLand
    ) {
      this.sprite.worldY = this.dimensions.landSurfaceY - this.sprite.size;
      this.sprite.vy = 0;
      this.sprite.onLand = true;
    }

    if (this.sprite.worldY >= this.dimensions.waterSurfaceY) {
      this.sprite.onLand = false;
    }

    if (this.sprite.onLand) {
      const minX = this.sprite.size;
      const maxX = this.canvasWidth - this.sprite.size;
      this.sprite.x = clamp(this.sprite.x, minX, maxX);
    }

    if (
      this.sprite.worldY > this.dimensions.landSurfaceY &&
      this.sprite.worldY < this.dimensions.widenY
    ) {
      const wellLeft = this.dimensions.wellX - this.dimensions.wellTopWidth / 2;
      const wellRight = this.dimensions.wellX + this.dimensions.wellTopWidth / 2;
      if (this.sprite.x - this.sprite.size / 2 < wellLeft) {
        this.sprite.x = wellLeft + this.sprite.size / 2;
        this.sprite.vx = 0;
      }
      if (this.sprite.x + this.sprite.size / 2 > wellRight) {
        this.sprite.x = wellRight - this.sprite.size / 2;
        this.sprite.vx = 0;
      }
    }

    if (!this.sprite.onLand && this.sprite.worldY > this.dimensions.waterSurfaceY) {
      const leftWall = this.dimensions.wallThickness;
      const rightWall = this.canvasWidth - this.dimensions.wallThickness;
      if (this.sprite.x - this.sprite.size / 2 < leftWall) {
        this.sprite.x = leftWall + this.sprite.size / 2;
        if (!this.sprite.isClimbing) this.sprite.vx = 0;
      }
      if (this.sprite.x + this.sprite.size / 2 > rightWall) {
        this.sprite.x = rightWall - this.sprite.size / 2;
        if (!this.sprite.isClimbing) this.sprite.vx = 0;
      }
    }

    if (this.sprite.worldY > this.canvasHeight / 2) {
      const targetCameraY = this.sprite.worldY - this.canvasHeight / 2;
      this.cameraY += (targetCameraY - this.cameraY) * Math.min(1, CAMERA_LERP * frameScale);
    } else {
      this.cameraY += (0 - this.cameraY) * Math.min(1, CAMERA_LERP * frameScale);
    }

    this.sprite.y = this.sprite.worldY - this.cameraY;

    const depthInPixels = this.sprite.worldY - this.dimensions.waterSurfaceY;
    if (depthInPixels > 10) {
      if (!this.sprite.inBubble) {
        this.sprite.oxygen -= OXYGEN_DEPLETION_RATE * frameScale;
        if (this.sprite.oxygen < 0) this.sprite.oxygen = 0;
      } else if (this.sprite.oxygen < this.sprite.maxOxygen) {
        this.sprite.oxygen += OXYGEN_RECHARGE_RATE * frameScale;
        if (this.sprite.oxygen > this.sprite.maxOxygen) this.sprite.oxygen = this.sprite.maxOxygen;
      }
    } else if (this.sprite.oxygen < this.sprite.maxOxygen) {
      this.sprite.oxygen += OXYGEN_RECHARGE_RATE * frameScale;
      if (this.sprite.oxygen > this.sprite.maxOxygen) this.sprite.oxygen = this.sprite.maxOxygen;
    }

    if (this.sprite.inBubble) {
      this.sprite.bubbleRadius -= this.sprite.airDepletionRate * frameScale;
      if (this.sprite.bubbleRadius <= this.sprite.size / 2 + 2) {
        this.sprite.inBubble = false;
        this.sprite.bubbleRadius = 0;
      }
    }

    this.updateBubbles(frameScale);

    if (
      this.sprite.worldY <= this.dimensions.landSurfaceY - this.sprite.size &&
      this.sprite.vy < -0.5
    ) {
      this.resurfacePending = true;
    }

    if (this.sprite.oxygen <= 0) {
      this.sprite.oxygen = this.sprite.maxOxygen;
      this.sprite.worldY = this.dimensions.waterSurfaceY + 20;
      this.sprite.vy = 0;
    }

    return this.resurfacePending;
  }

  isActive(): boolean {
    return this.active;
  }

  consumeResurfaceRequest(): boolean {
    const pending = this.resurfacePending;
    this.resurfacePending = false;
    return pending;
  }

  exit(): void {
    this.active = false;
    this.pointer.active = false;
    this.resurfacePending = false;
    if (this.sprite) {
      this.sprite.isClimbing = false;
    }
  }

  getSpriteState(): WellSprite | null {
    return this.sprite ? { ...this.sprite } : null;
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.sprite || !this.dimensions) return;
    this.canvasWidth = width;
    this.canvasHeight = height;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;

    const landY = this.dimensions.landSurfaceY - this.cameraY;
    const widenY = this.dimensions.widenY - this.cameraY;
    const waterY = this.dimensions.waterSurfaceY - this.cameraY;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, landY);
    ctx.lineTo(width, landY);
    ctx.stroke();

    const wellTopLeft = this.dimensions.wellX - this.dimensions.wellTopWidth / 2;
    const wellTopRight = this.dimensions.wellX + this.dimensions.wellTopWidth / 2;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = this.dimensions.wallThickness;
    ctx.beginPath();
    ctx.moveTo(wellTopLeft, landY);
    ctx.lineTo(wellTopLeft, widenY);
    ctx.lineTo(0, widenY);
    ctx.lineTo(0, height);
    ctx.moveTo(wellTopRight, landY);
    ctx.lineTo(wellTopRight, widenY);
    ctx.lineTo(width, widenY);
    ctx.lineTo(width, height);
    ctx.stroke();

    ctx.strokeStyle = '#0088ff';
    ctx.lineWidth = 2;

    const nowMs = window.performance?.now?.() ?? Date.now();
    if (nowMs - this.lastWaterToggle > 1000) {
      this.waterDashOffset = this.waterDashOffset === 0 ? 1 : 0;
      this.lastWaterToggle = nowMs;
    }

    const dashLength = 10;
    const gapLength = 8;
    let currentX = 0;
    let dashOn = this.waterDashOffset === 0;
    let dashIndex = 0;

    ctx.beginPath();
    while (currentX < width) {
      if (dashOn) {
        const offset = dashIndex % 3 === 0 ? -2 : dashIndex % 3 === 1 ? 0 : 2;
        ctx.moveTo(currentX, waterY + offset);
        ctx.lineTo(currentX + dashLength, waterY + offset);
        currentX += dashLength;
        dashIndex += 1;
      } else {
        currentX += gapLength;
      }
      dashOn = !dashOn;
    }
    ctx.stroke();

    if (this.sprite.worldY > this.dimensions.waterSurfaceY) {
      for (const star of this.underwaterStars) {
        const screenY = star.worldY - this.cameraY;
        if (screenY > waterY && screenY < height) {
          ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
          ctx.fillRect(star.x, screenY, star.size, star.size);
        }
      }
    }

    for (const bubble of this.bubbles) {
      if (!bubble.active) continue;
      const screenY = bubble.worldY - this.cameraY;
      if (screenY > -100 && screenY < height + 100) {
        this.drawPixelatedBubble(ctx, Math.round(bubble.x), Math.round(screenY), bubble.radius, true, bubble.trail);
      }
    }

    if (this.sprite.inBubble) {
      this.drawPixelatedBubble(
        ctx,
        Math.round(this.sprite.x),
        Math.round(this.sprite.y),
        this.sprite.bubbleRadius,
        false,
        []
      );
    }

    ctx.fillStyle = '#ffffff';
    const sx = Math.round(this.sprite.x - this.sprite.size / 2);
    const sy = Math.round(this.sprite.y - this.sprite.size / 2);
    ctx.fillRect(sx, sy, this.sprite.size, this.sprite.size);

    this.drawMeters(ctx, width, height, waterY);

    if (this.pointer.active) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.pointer.startX, this.pointer.startY, 40, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawMeters(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    waterY: number
  ): void {
    if (!this.sprite || !this.dimensions) return;

    const meterWidth = 100;
    const meterHeight = 10;
    const meterX = 10;
    const meterY = 10;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(meterX, meterY, meterWidth, meterHeight);
    ctx.fillStyle = '#ffffff';
    const powerWidth = (this.sprite.power / this.sprite.maxPower) * meterWidth;
    ctx.fillRect(meterX, meterY, powerWidth, meterHeight);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(meterX, meterY, meterWidth, meterHeight);

    if (this.sprite.worldY > this.dimensions.waterSurfaceY - 100) {
      const oxygenMeterY = meterY + meterHeight + 5;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(meterX, oxygenMeterY, meterWidth, meterHeight);

      const oxygenPercent = this.sprite.oxygen / this.sprite.maxOxygen;
      if (oxygenPercent > 0.5) {
        ctx.fillStyle = '#ffffff';
      } else if (oxygenPercent > 0.25) {
        ctx.fillStyle = '#ffff00';
      } else {
        ctx.fillStyle = '#ff0000';
      }
      const oxygenWidth = oxygenPercent * meterWidth;
      ctx.fillRect(meterX, oxygenMeterY, oxygenWidth, meterHeight);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(meterX, oxygenMeterY, meterWidth, meterHeight);

      const depth = Math.max(0, Math.floor((this.sprite.worldY - this.dimensions.waterSurfaceY) / 10));
      const depthMeterX = 10;
      const depthMeterY = height / 2 - 150;
      const depthMeterHeight = 300;
      const depthMeterWidth = 4;
      const tickLength = 12;
      const tickSpacing = 20;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(depthMeterX, depthMeterY, depthMeterWidth, depthMeterHeight);

      const numTicks = Math.floor(depthMeterHeight / tickSpacing);
      for (let i = 0; i <= numTicks; i += 1) {
        const tickY = depthMeterY + i * tickSpacing;
        ctx.fillRect(depthMeterX - tickLength, tickY, tickLength, 2);
      }

      const depthText = `${depth.toString().padStart(2, '0')}m`;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(depthText, depthMeterX + depthMeterWidth + 8, depthMeterY + depthMeterHeight / 2);
    }
  }

  private drawPixelatedBubble(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    drawTrail: boolean,
    trail: BubbleTrail[]
  ): void {
    const patternSize = bubblePattern.length;
    const scale = (radius * 2) / (patternSize * this.pixelSize);
    const scaledPixelSize = this.pixelSize * scale;

    ctx.fillStyle = '#ffffff';
    for (let row = 0; row < patternSize; row += 1) {
      for (let col = 0; col < patternSize; col += 1) {
        if (bubblePattern[row][col] === 1) {
          ctx.fillRect(
            cx - radius + col * scaledPixelSize,
            cy - radius + row * scaledPixelSize,
            scaledPixelSize,
            scaledPixelSize
          );
        }
      }
    }

    if (!drawTrail || !trail) return;

    for (const t of trail) {
      const screenY = t.worldY - this.cameraY;
      ctx.fillStyle = `rgba(255, 255, 255, ${t.life})`;
      const trailSize = trailPattern.length;
      const trailScale = scale * 0.5;
      const trailPixelSize = this.pixelSize * trailScale;
      for (let row = 0; row < trailSize; row += 1) {
        for (let col = 0; col < trailSize; col += 1) {
          if (trailPattern[row][col] === 1) {
            ctx.fillRect(
              t.x - (trailSize * trailPixelSize) / 2 + col * trailPixelSize,
              screenY + row * trailPixelSize,
              trailPixelSize,
              trailPixelSize
            );
          }
        }
      }
    }
  }
}
