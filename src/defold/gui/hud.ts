import { ENERGY_MAX, ENERGY_REGEN_RATE, COOLDOWN_TIME } from '../config/constants.js';
import { clamp, now } from '../shared/utils.js';
import { gameOverContainer } from '../../web/state/ui_state.js';
import {
  drawPixelatedHeart,
  HEART_PIXEL_COLUMNS,
  HEART_PIXEL_ROWS,
  computeHeartBobOffset,
} from './drawPixelatedHeart.js';
type EnergySegmentState = 'filled' | 'empty';

interface EnergySegment {
  x: number;
  y: number;
  size: number;
  state: EnergySegmentState;
}

const ENERGY_SEGMENT_COUNT = 10;
const ENERGY_SEGMENT_SIZE = 7;
const ENERGY_SEGMENT_SPACING = 2;
const ENERGY_BAR_HEIGHT = 14;
const ENERGY_BAR_BG = 'rgba(255,255,255,0)';
const ENERGY_SEGMENT_COLOR = '#ffffff';
const ENERGY_SEGMENT_PARTIAL_COLOR = '#ffe68b';
const ENERGY_SEGMENT_EMPTY_SHADE = 'rgba(255,255,255,0)';

export class EnergyBar {
  energy: number;
  state: 'active' | 'cooldown';
  cooldown: number;
  private readonly segments: EnergySegment[];
  private readonly segmentCapacity: number;
  private readonly x = 12;
  private readonly y = 12;
  private readonly barWidth: number;

  constructor() {
    this.energy = ENERGY_MAX * 0.9;
    this.state = 'active';
    this.cooldown = 0;
    this.barWidth =
      ENERGY_SEGMENT_COUNT * ENERGY_SEGMENT_SIZE +
      (ENERGY_SEGMENT_COUNT - 1) * ENERGY_SEGMENT_SPACING;
    this.segments = this.createSegments();
    this.segmentCapacity =
      ENERGY_SEGMENT_COUNT > 0 ? ENERGY_MAX / ENERGY_SEGMENT_COUNT : ENERGY_MAX;
    this.applyInitialSegments();
  }

  canUse() {
    return this.state === 'active' && this.energy > 0;
  }

  drain(amount: number) {
    if (this.state !== 'active') return;
    this.energy = clamp(this.energy - amount, 0, ENERGY_MAX);
    if (this.energy <= 0) this.startCooldown();
    this.syncSegmentsToEnergy();
  }

  startCooldown() {
    this.state = 'cooldown';
    this.cooldown = COOLDOWN_TIME;
    this.energy = 0;
    this.syncSegmentsToEnergy();
  }

  extendCooldown(dt: number) {
    if (this.state === 'cooldown') this.cooldown += dt;
  }

  update(dt: number, canRecharge: boolean) {
    if (this.state === 'cooldown') {
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.state = 'active';
        this.cooldown = 0;
      } else {
        this.energy = 0;
      }
    } else if (canRecharge) {
      this.energy = clamp(this.energy + ENERGY_REGEN_RATE * 0.3 * dt, 0, ENERGY_MAX);
    }

    this.syncSegmentsToEnergy();
  }

  getBounds(): { x: number; y: number; width: number; height: number } {
    return { x: this.x, y: this.y, width: this.barWidth, height: ENERGY_BAR_HEIGHT };
  }

  draw(ctx: CanvasRenderingContext2D) {
    const barX = this.x;
    const barY = this.y;
    const barH = ENERGY_BAR_HEIGHT;

    ctx.fillStyle = ENERGY_BAR_BG;
    ctx.fillRect(barX, barY, this.barWidth, barH);
    // ctx.strokeStyle = '#0a2';
    ctx.strokeRect(barX, barY, this.barWidth, barH);

    const segmentsToFill = this.getTargetSegmentCount();
    const partialRatio = this.getPartialRatio();

    for (let i = 0; i < this.segments.length; i += 1) {
      const segment = this.segments[i];
      const { x, y, size, state } = segment;

      ctx.fillStyle = ENERGY_SEGMENT_EMPTY_SHADE;
      ctx.fillRect(x, y, size, size);

      if (state === 'filled') {
        ctx.fillStyle = ENERGY_SEGMENT_COLOR;
        ctx.fillRect(x, y, size, size);
      } else if (state === 'empty' && i === segmentsToFill && partialRatio > 0 && partialRatio < 1) {
        const partialWidth = Math.max(1, Math.round(size * partialRatio));
        ctx.fillStyle = ENERGY_SEGMENT_PARTIAL_COLOR;
        ctx.fillRect(x, y, partialWidth, size);
      }

      // ctx.strokeStyle = 'rgba(17, 87, 52, 0.9)';
      // ctx.strokeRect(x - 0.5, y - 0.5, size + 1, size + 1);
    }

    if (this.state === 'cooldown') {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '10px "Tiny5", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('COOLING…', barX + this.barWidth + 8, barY - 1);
    }
  }

  private createSegments(): EnergySegment[] {
    const segments: EnergySegment[] = [];
    const baseY = this.y + (ENERGY_BAR_HEIGHT - ENERGY_SEGMENT_SIZE) / 2;

    for (let i = 0; i < ENERGY_SEGMENT_COUNT; i += 1) {
      const x =
        this.x +
        i * ENERGY_SEGMENT_SIZE +
        i * ENERGY_SEGMENT_SPACING;
      segments.push({
        x,
        y: baseY,
        size: ENERGY_SEGMENT_SIZE,
        state: 'empty',
      });
    }

    return segments;
  }

  private applyInitialSegments(): void {
    const target = this.getTargetSegmentCount();
    for (let i = 0; i < this.segments.length; i += 1) {
      const segment = this.segments[i];
      segment.state = i < target ? 'filled' : 'empty';
    }
  }

  private syncSegmentsToEnergy(): void {
    const targetCount = this.getTargetSegmentCount();

    for (let i = 0; i < this.segments.length; i += 1) {
      const segment = this.segments[i];

      segment.state = i < targetCount ? 'filled' : 'empty';
    }
  }

  private getTargetSegmentCount(): number {
    if (!Number.isFinite(this.segmentCapacity) || this.segmentCapacity <= 0) return 0;
    const raw = Math.floor(this.energy / this.segmentCapacity);
    return clamp(raw, 0, this.segments.length);
  }

  private getPartialRatio(): number {
    if (!Number.isFinite(this.segmentCapacity) || this.segmentCapacity <= 0) return 0;
    const fullSegments = this.getTargetSegmentCount();
    if (fullSegments >= this.segments.length) return 0;
    const remaining = this.energy - fullSegments * this.segmentCapacity;
    const ratio = remaining / this.segmentCapacity;
    return clamp(ratio, 0, 1);
  }
}

export class Hearts {
  max: number;
  value: number;

  constructor() {
    this.max = 4;
    this.value = 3;
  }

  takeDamage(onZero?: () => void) {
    this.value = Math.max(0, this.value - 1);
    if (this.value === 0 && typeof onZero === 'function') onZero();
  }

  gain(amount = 1) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.value = Math.min(this.max, this.value + amount);
  }

  draw(ctx: CanvasRenderingContext2D, timeMs?: number) {
    const x0 = 12;
    const y0 = 28;
    const pixelSize = 2;
    const heartWidth = HEART_PIXEL_COLUMNS * pixelSize;
    const heartHeight = HEART_PIXEL_ROWS * pixelSize;
    const pad = 6;
    const activeTime = Number.isFinite(timeMs) ? timeMs : now();

    for (let i = 0; i < this.max; i += 1) {
      const color = i < this.value ? '#ff5b6e' : 'rgba(255,255,255,0.2)';
      const x = x0 + i * (heartWidth + pad);
      const y = y0 + (heartHeight < 16 ? (16 - heartHeight) / 2 : 0);
      const bob = computeHeartBobOffset(activeTime, pixelSize, i * 120);
      drawPixelatedHeart(ctx, x, y + bob, pixelSize, color);
    }
  }
}

// Reference game over div so TypeScript recognises usage
void gameOverContainer;
