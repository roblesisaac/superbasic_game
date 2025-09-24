import {
  GATE_THICKNESS,
  PIXELS_PER_FOOT,
  GATE_EVERY_FEET,
  GATE_GAP_WIDTH,
  USE_RANDOM_GATES,
} from '../config/constants.js';
import {
  ControlledGateGenerator,
  type CollisionRect,
  CONTROLLED_GATE_PATTERNS,
  ControlledGate,
  type ControlledGateDefinition
} from './controlledGate.js';
import { asciiArtEnabled } from '../systems/settings.js';

type GateRect = {
  type: 'H' | 'V';
  index: number | string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type GateGapInfo = { type: 'H' | 'V'; index: number | string } | null;

export class Gate {
  y: number;
  canvasWidth: number;
  gapWidth: number;
  segmentCount: number;
  active: boolean;
  floating: boolean;
  speed: number;
  direction: number;
  originalSpeed: number;
  rewardEnabled: boolean;
  asciiDamaged: boolean;
  horizontalSegments: number[];
  verticalOffsets: number[];
  rects: GateRect[];
  gapInfo: GateGapInfo;
  gapX: number;
  gapY: number;
  originX: number;

  constructor({ y, canvasWidth, gapWidth, segmentCount, originX = 0 }: {
    y: number;
    canvasWidth: number;
    gapWidth: number;
    segmentCount: number;
    originX?: number;
  }) {
    this.y = y;
    this.canvasWidth = canvasWidth;
    this.gapWidth = gapWidth;
    this.segmentCount = Math.max(1, Math.min(3, Math.floor(segmentCount || 1)));
    this.originX = originX ?? 0;

    this.active = true;
    this.floating = false;
    this.speed = 0;
    this.direction = 0;
    this.originalSpeed = 0;
    this.rewardEnabled = true;
    this.asciiDamaged = false;

    this._generateLayout();
    this._chooseGap();
  }

  update() {}

  startFloating() {}

  handleBottomCollision() {
    if (!this.asciiDamaged) {
      this.asciiDamaged = true;
    }
    this.rewardEnabled = false;
  }

  isRewardEnabled() {
    return this.rewardEnabled;
  }

  _generateLayout() {
    const thickness = GATE_THICKNESS;
    const minHorizontalSpan = 60;
    const totalHorizontalSpan = this.canvasWidth;

    const segments = this.segmentCount;
    const remaining = totalHorizontalSpan - segments * minHorizontalSpan;
    const cuts = [];
    for (let i = 0; i < segments - 1; i++) cuts.push(Math.random());
    cuts.sort((a, b) => a - b);

    const shares = [
      cuts[0],
      ...cuts.slice(1).map((value, index) => value - cuts[index]),
      1 - cuts[cuts.length - 1]
    ];
    const extraSpans = shares.map(share => share * remaining);

    this.horizontalSegments = [];
    for (let i = 0; i < segments; i++) {
      this.horizontalSegments.push(minHorizontalSpan + extraSpans[i]);
    }

    this.verticalOffsets = [];
    const baseMagnitude = 20;
    const extraMagnitude = 80;
    let direction = Math.random() > 0.5 ? 1 : -1;
    for (let i = 0; i < segments - 1; i++) {
      const magnitude = baseMagnitude + Math.random() * extraMagnitude;
      this.verticalOffsets.push(direction * magnitude);
      direction *= -1;
    }

    this.rects = [];
    let cursorX = 0;
    let currentY = this.y;

    for (let i = 0; i < segments; i++) {
      const width = this.horizontalSegments[i];
      const horizontalRect: GateRect = {
        type: 'H',
        index: i,
        x: this.originX + cursorX,
        y: currentY - thickness / 2,
        w: width,
        h: thickness
      };
      this.rects.push(horizontalRect);

      if (i < segments - 1) {
        const nextY = currentY + this.verticalOffsets[i];
        const top = Math.min(currentY, nextY) - thickness / 2;
        const verticalRect: GateRect = {
          type: 'V',
          index: i,
          x: this.originX + cursorX + width - thickness / 2,
          y: top,
          w: thickness,
          h: Math.abs(nextY - currentY) + thickness
        };
        this.rects.push(verticalRect);
        currentY = nextY;
      }

      cursorX += width;
    }
  }

  _chooseGap() {
    const candidates = this.rects.filter(rect => (
      (rect.type === 'H' && rect.w > this.gapWidth + 10) ||
      (rect.type === 'V' && rect.h > this.gapWidth + 10)
    ));
    const target = candidates.length
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : this.rects[0];

    this.gapInfo = { type: target.type, index: target.index };

    if (target.type === 'H') {
      const minX = target.x + 5;
      const maxX = target.x + target.w - this.gapWidth - 5;
      this.gapX = Math.max(minX, Math.min(maxX, minX + Math.random() * (maxX - minX)));
      this.gapY = target.y;
    } else {
      const minY = target.y + 5;
      const maxY = target.y + target.h - this.gapWidth - 5;
      this.gapY = Math.max(minY, Math.min(maxY, minY + Math.random() * (maxY - minY)));
      this.gapX = target.x;
    }
  }

  getRects(): CollisionRect[] {
    const output: CollisionRect[] = [];

    for (const rect of this.rects) {
      if (this.gapInfo && rect.type === this.gapInfo.type && rect.index === this.gapInfo.index) {
        if (rect.type === 'H') {
          const leftWidth = Math.max(0, this.gapX - rect.x);
          const rightWidth = Math.max(0, rect.x + rect.w - (this.gapX + this.gapWidth));
          if (leftWidth > 0) output.push({ x: rect.x, y: rect.y, w: leftWidth, h: rect.h });
          if (rightWidth > 0) output.push({ x: this.gapX + this.gapWidth, y: rect.y, w: rightWidth, h: rect.h });
        } else {
          const topHeight = Math.max(0, this.gapY - rect.y);
          const bottomHeight = Math.max(0, rect.y + rect.h - (this.gapY + this.gapWidth));
          if (topHeight > 0) output.push({ x: rect.x, y: rect.y, w: rect.w, h: topHeight });
          if (bottomHeight > 0) output.push({ x: rect.x, y: this.gapY + this.gapWidth, w: rect.w, h: bottomHeight });
        }
      } else {
        output.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
      }
    }

    return output;
  }

  getGapSurfaceY(): number {
    if (this.gapInfo) {
      const rect = this.rects.find(
        (r) => r.type === this.gapInfo?.type && r.index === this.gapInfo?.index
      );
      if (rect) return rect.y;
    }

    const firstHorizontal = this.rects.find((rect) => rect.type === 'H');
    if (firstHorizontal) return firstHorizontal.y;

    return this.y - GATE_THICKNESS / 2;
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    if (!this.active) return;

    if (asciiArtEnabled) {
      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const horizontalGlyph = this.asciiDamaged ? '.' : ':';
      const verticalGlyph = this.asciiDamaged ? ':' : '::';
      for (const rect of this.getRects()) {
        if (rect.w > 0 && rect.h > 0) {
          const screenX = rect.x - cameraX;
          if (rect.w > rect.h) {
            const count = Math.max(1, Math.floor(rect.w / 10));
            const ascii = horizontalGlyph.repeat(count);
            ctx.fillText(ascii, screenX + rect.w / 2, rect.y - cameraY + rect.h / 2);
          } else {
            const count = Math.max(1, Math.floor(rect.h / 16));
            for (let i = 0; i < count; i++) {
              ctx.fillText(
                verticalGlyph,
                screenX + rect.w / 2,
                rect.y - cameraY + (i + 0.5) * (rect.h / count)
              );
            }
          }
        }
      }
    } else {
      ctx.fillStyle = '#5aa2ff';
      for (const rect of this.getRects()) {
        if (rect.w > 0 && rect.h > 0) {
          ctx.fillRect(rect.x - cameraX, rect.y - cameraY, rect.w, rect.h);
        }
      }

      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      if (this.gapInfo?.type === 'H') {
        const gapY = this.gapY;
        ctx.fillRect(this.gapX - cameraX, gapY - cameraY, 1, GATE_THICKNESS);
        ctx.fillRect(
          this.gapX + this.gapWidth - cameraX,
          gapY - cameraY,
          1,
          GATE_THICKNESS
        );
      } else if (this.gapInfo?.type === 'V') {
        const gapX = this.gapX;
        ctx.fillRect(gapX - cameraX, this.gapY - cameraY, GATE_THICKNESS, 1);
        ctx.fillRect(
          gapX - cameraX,
          this.gapY + this.gapWidth - cameraY,
          GATE_THICKNESS,
          1
        );
      }
    }
  }
}

function deepClone<T>(value: T): T {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(item => deepClone(item)) as unknown as T;
  }

  const output: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    output[key] = deepClone(val);
  }

  return output as T;
}

let nextCardGatePatternIndex = 0;

export function resetCardGateFactory() {
  nextCardGatePatternIndex = 0;
}

export function createGateForCardTop({
  y,
  width: canvasWidth,
  originX = 0,
  definition
}: {
  y: number;
  width: number;
  originX?: number;
  definition?: ControlledGateDefinition | null;
}) {
  if (USE_RANDOM_GATES) {
    const segmentCount = Math.floor(Math.random() * 3) + 1;
    return new Gate({
      y,
      canvasWidth,
      gapWidth: GATE_GAP_WIDTH,
      segmentCount,
      originX
    });
  }

  let gateDefinition: ControlledGateDefinition | undefined;
  if (definition != null) {
    gateDefinition = deepClone(definition);
  } else {
    const pattern = CONTROLLED_GATE_PATTERNS[nextCardGatePatternIndex % CONTROLLED_GATE_PATTERNS.length];
    nextCardGatePatternIndex += 1;
    gateDefinition = deepClone(pattern);
  }

  return new ControlledGate({
    y,
    canvasWidth,
    definition: gateDefinition ?? { width: 100 },
    originX
  });
}

export class GateGenerator {
  canvasWidth: number;
  gapWidth: number;
  spacingFeet: number;
  createdFeet: Set<number>;
  lastSegmentCount: number;
  controlledGenerator: ControlledGateGenerator | null;

  constructor({
    canvasWidth,
    gapWidth = GATE_GAP_WIDTH,
    spacingFeet = GATE_EVERY_FEET,
    createdFeet = new Set<number>(),
  }: {
    canvasWidth: number;
    gapWidth?: number;
    spacingFeet?: number;
    createdFeet?: Set<number>;
  }) {
    this.canvasWidth = canvasWidth;
    this.gapWidth = gapWidth;
    this.spacingFeet = spacingFeet;
    this.createdFeet = createdFeet;
    this.lastSegmentCount = 0;
    this.controlledGenerator = USE_RANDOM_GATES
      ? null
      : new ControlledGateGenerator({
          canvasWidth: this.canvasWidth,
          spacingFeet: this.spacingFeet,
          createdFeet: this.createdFeet,
        });
  }

  setCanvasWidth(width: number) {
    this.canvasWidth = width;
    if (this.controlledGenerator) {
      this.controlledGenerator.setCanvasWidth(width);
    }
  }

  resetLastSegmentCount() {
    this.lastSegmentCount = 0;
    if (this.controlledGenerator) {
      this.controlledGenerator.resetPatternIndex();
    }
  }

  ensureGates({ spriteY, groundY }: { spriteY: number; groundY: number }): any[] {
    if (typeof spriteY !== 'number' || typeof groundY !== 'number') return [];

    if (!USE_RANDOM_GATES) {
      if (!this.controlledGenerator) {
        this.controlledGenerator = new ControlledGateGenerator({
          canvasWidth: this.canvasWidth,
          spacingFeet: this.spacingFeet,
          createdFeet: this.createdFeet,
        });
      }
      return this.controlledGenerator.ensureGates({ spriteY, groundY });
    }

    const currentFeet = Math.max(0, Math.floor((groundY - spriteY) / PIXELS_PER_FOOT));
    const index = Math.floor(currentFeet / this.spacingFeet);
    const baseFeet = Math.max(this.spacingFeet, index * this.spacingFeet);
    const nextFeet = (index + 1) * this.spacingFeet;

    const gates: Gate[] = [];
    for (const feet of [baseFeet, nextFeet]) {
      const gate = this._createGateAtFeet(feet, groundY);
      if (gate) gates.push(gate);
    }
    return gates;
  }

  _createGateAtFeet(feet: number, groundY: number) {
    if (this.createdFeet.has(feet) || feet <= 0) return null;

    const y = groundY - feet * PIXELS_PER_FOOT;
    const gate = new Gate({
      y,
      canvasWidth: this.canvasWidth,
      gapWidth: this.gapWidth,
      segmentCount: this._chooseSegmentCount(),
    });
    this.createdFeet.add(feet);
    return gate;
  }

  _chooseSegmentCount() {
    let count = Math.floor(Math.random() * 3) + 1;
    if (this.lastSegmentCount !== 0) {
      while (count === this.lastSegmentCount) {
        count = Math.floor(Math.random() * 3) + 1;
      }
    }
    this.lastSegmentCount = count;
    return count;
  }
}

export function updateGates(gates, dt) {
  for (const gate of gates) gate.update(dt);
}

export function pruneInactiveGates(gates) {
  for (let i = gates.length - 1; i >= 0; i--) {
    if (!gates[i] || gates[i].active === false) gates.splice(i, 1);
  }
}

export function drawGates(ctx, gates, cameraX, cameraY) {
  for (const gate of gates) gate.draw(ctx, cameraX, cameraY);
}

export function getGateSeamSurfaceY(gate: Gate | ControlledGate): number {
  if (gate && typeof (gate as any).getGapSurfaceY === 'function') {
    return (gate as any).getGapSurfaceY();
  }
  return gate ? gate.y - GATE_THICKNESS / 2 : 0;
}
