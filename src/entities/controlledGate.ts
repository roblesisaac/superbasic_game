import {
  GATE_THICKNESS,
  PIXELS_PER_FOOT,
  GATE_GAP_WIDTH,
} from '../config/constants.js';
import { asciiArtEnabled } from '../systems/settings.js';

const DEFAULT_VERTICAL_HEIGHT = 80; // Default height for auto-generated vertical connectors

type GateSpecObject = { position?: number; width?: number };
type GateSpecArray = [unknown, unknown?, unknown?];
type GateSpec = boolean | GateSpecObject | GateSpecArray | null;

type LegacySegmentTuple = [
  number,
  number | [number, number] | null | undefined,
  GateSpec,
  boolean?
];

interface SegmentDefinitionObject {
  type?: 'horizontal' | 'vertical';
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  gate?: GateSpec | true;
}

type SegmentInput = number | LegacySegmentTuple | SegmentDefinitionObject;

export type ControlledGateDefinition =
  | number
  | SegmentDefinitionObject
  | SegmentInput[]
  | { segments: SegmentDefinitionObject[] };

interface BaseSegment {
  type: 'horizontal' | 'vertical';
  widthPercent: number;
  xOffset: number;
  yOffset: number;
  gateSpec: GateSpec;
}

interface HorizontalSegment extends BaseSegment {
  type: 'horizontal';
}

interface VerticalSegment extends BaseSegment {
  type: 'vertical';
  heightPixels: number;
}

type Segment = HorizontalSegment | VerticalSegment;

interface GateRect {
  type: 'H' | 'V';
  index: number | string;
  x: number;
  y: number;
  w: number;
  h: number;
  segment: Segment | null;
}

export interface CollisionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface GapInfo {
  type: GateRect['type'];
  index: GateRect['index'];
  rect: GateRect;
}

interface ControlledGateOptions {
  y: number;
  canvasWidth: number;
  definition: ControlledGateDefinition;
}

export class ControlledGate {
  y: number;
  canvasWidth: number;
  definition: ControlledGateDefinition;
  active = true;
  floating = false;
  speed = 0;
  direction = 0;
  originalSpeed = 0;
  segments: Segment[] = [];
  rects: GateRect[] = [];
  gapInfo?: GapInfo;
  gapX = 0;
  gapY = 0;
  gapWidth = GATE_GAP_WIDTH;

  constructor({ y, canvasWidth, definition }: ControlledGateOptions) {
    this.y = y;
    this.canvasWidth = canvasWidth;
    this.definition = definition;

    this._parseDefinition();
    this._generateLayout();
    this._ensureGap();
  }

  update(): void {}
  startFloating(): void {}

  setCanvasWidth(width: number): void {
    const normalizedWidth = Number(width);
    if (!Number.isFinite(normalizedWidth) || normalizedWidth <= 0) return;
    if (Math.abs(normalizedWidth - this.canvasWidth) < 0.01) return;

    this.canvasWidth = normalizedWidth;
    this.gapInfo = undefined;
    this._parseDefinition();
    this._generateLayout();
    this._ensureGap();
  }

  private _parseDefinition(): void {
    const definition = this.definition;

    if (typeof definition === 'number') {
      this.segments = [
        {
          type: 'horizontal',
          widthPercent: definition,
          yOffset: 0,
          xOffset: 0,
          gateSpec: null,
        },
      ];
      return;
    }

    if (Array.isArray(definition)) {
      this._parseSegmentsArray(definition);
      return;
    }

    if (
      definition &&
      typeof definition === 'object' &&
      'segments' in definition &&
      Array.isArray(definition.segments)
    ) {
      this.segments = definition.segments.map((seg) => this._normalizeSegment(seg));
      return;
    }

    if (definition && typeof definition === 'object') {
      this.segments = [this._normalizeSegment(definition as SegmentDefinitionObject)];
      return;
    }

    this.segments = [
      {
        type: 'horizontal',
        widthPercent: 100,
        yOffset: 0,
        xOffset: 0,
        gateSpec: null,
      },
    ];
  }

  private _parseSegmentsArray(definition: SegmentInput[]): void {
    this.segments = [];
    let autoVerticalOffset = 0;

    definition.forEach((segDef, index) => {
      if (typeof segDef === 'number') {
        if (index > 0) {
          autoVerticalOffset =
            autoVerticalOffset === 0 ? DEFAULT_VERTICAL_HEIGHT : -autoVerticalOffset;
        }
        this.segments.push({
          type: 'horizontal',
          widthPercent: segDef,
          yOffset: autoVerticalOffset,
          xOffset: 0,
          gateSpec: null,
        });
        return;
      }

      if (Array.isArray(segDef)) {
        const [widthPercent, yXPos, gateSpecs, isVertical] = segDef as LegacySegmentTuple;

        let yOffset = 0;
        let xOffsetPercent = 0;

        if (typeof yXPos === 'number') {
          yOffset = yXPos;
          autoVerticalOffset = yOffset;
        } else if (Array.isArray(yXPos) && yXPos.length >= 2) {
          const [y, x] = yXPos as [number, number];
          yOffset = y;
          xOffsetPercent = x;
          autoVerticalOffset = yOffset;
        } else if (yXPos == null && index > 0) {
          autoVerticalOffset =
            autoVerticalOffset === 0 ? DEFAULT_VERTICAL_HEIGHT : -autoVerticalOffset;
          yOffset = autoVerticalOffset;
        }

        if (isVertical) {
          this.segments.push({
            type: 'vertical',
            widthPercent: GATE_THICKNESS,
            heightPixels:
              typeof widthPercent === 'number' ? widthPercent : DEFAULT_VERTICAL_HEIGHT,
            yOffset,
            xOffset: (xOffsetPercent / 100) * this.canvasWidth,
            gateSpec: gateSpecs ?? null,
          });
        } else {
          this.segments.push({
            type: 'horizontal',
            widthPercent: typeof widthPercent === 'number' ? widthPercent : 50,
            yOffset,
            xOffset: (xOffsetPercent / 100) * this.canvasWidth,
            gateSpec: gateSpecs ?? null,
          });
        }
        return;
      }

      if (segDef && typeof segDef === 'object') {
        const normalized = this._normalizeSegment(segDef as SegmentDefinitionObject);
        if (index > 0 && normalized.type === 'horizontal' && normalized.yOffset === 0) {
          autoVerticalOffset =
            autoVerticalOffset === 0 ? DEFAULT_VERTICAL_HEIGHT : -autoVerticalOffset;
          normalized.yOffset = autoVerticalOffset;
        } else if (normalized.yOffset !== 0) {
          autoVerticalOffset = normalized.yOffset;
        }
        this.segments.push(normalized);
      }
    });
  }

  private _normalizeSegment(segment: SegmentDefinitionObject): Segment {
    const type = segment.type === 'vertical' ? 'vertical' : 'horizontal';
    const gateSpec = (segment.gate ?? null) as GateSpec;

    if (type === 'vertical') {
      const height = segment.height ?? DEFAULT_VERTICAL_HEIGHT;
      return {
        type,
        widthPercent: GATE_THICKNESS,
        heightPixels: height,
        yOffset: segment.y ?? 0,
        xOffset: segment.x ? (segment.x / 100) * this.canvasWidth : 0,
        gateSpec,
      };
    }

    return {
      type: 'horizontal',
      widthPercent: segment.width ?? 50,
      yOffset: segment.y ?? 0,
      xOffset: segment.x ? (segment.x / 100) * this.canvasWidth : 0,
      gateSpec,
    };
  }

  private _generateLayout(): void {
    this.rects = [];
    let cursorX = 0;
    let currentY = this.y;

    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];

      if (segment.type === 'vertical') {
        const height = segment.heightPixels ?? DEFAULT_VERTICAL_HEIGHT;
        const rect: GateRect = {
          type: 'V',
          index: i,
          x: cursorX - GATE_THICKNESS / 2,
          y: currentY - GATE_THICKNESS / 2,
          w: GATE_THICKNESS,
          h: height,
          segment,
        };
        this.rects.push(rect);
        currentY += height;
        continue;
      }

      const segmentWidth = (this.canvasWidth * segment.widthPercent) / 100;
      const targetY = currentY + segment.yOffset;

      if (segment.yOffset !== 0 && i > 0) {
        const connectorRect: GateRect = {
          type: 'V',
          index: `${i - 1}-to-${i}-connector`,
          x: cursorX - GATE_THICKNESS / 2,
          y: Math.min(currentY, targetY) - GATE_THICKNESS / 2,
          w: GATE_THICKNESS,
          h: Math.abs(targetY - currentY) + GATE_THICKNESS,
          segment: null,
        };
        this.rects.push(connectorRect);
      }

      const xPosition = cursorX + segment.xOffset;
      const rect: GateRect = {
        type: 'H',
        index: i,
        x: xPosition,
        y: targetY - GATE_THICKNESS / 2,
        w: segmentWidth,
        h: GATE_THICKNESS,
        segment,
      };
      this.rects.push(rect);

      cursorX = xPosition + segmentWidth;
      currentY = targetY;
    }
  }

  private _ensureGap(): void {
    const segmentsWithGates = this.segments.filter((seg) => seg.gateSpec);

    if (segmentsWithGates.length === 0) {
      const firstHorizontal = this.segments.find((seg) => seg.type === 'horizontal');
      if (firstHorizontal) firstHorizontal.gateSpec = true;
    }

    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];
      if (!segment.gateSpec) continue;

      const rect = this.rects.find((r) => r.index === i && r.segment === segment);
      if (!rect) continue;

      let hasGate = false;
      let gatePosition = 50;
      let gateWidth = GATE_GAP_WIDTH;

      const spec = segment.gateSpec;
      if (spec === true) {
        hasGate = true;
      } else if (spec && Array.isArray(spec)) {
        const [hasGateSpec, posSpec, widthSpec] = spec;
        hasGate = Boolean(hasGateSpec);
        if (typeof posSpec === 'number') gatePosition = posSpec;
        if (typeof widthSpec === 'number') gateWidth = widthSpec;
      } else if (spec && !Array.isArray(spec) && typeof spec === 'object') {
        const specObject = spec as GateSpecObject;
        hasGate = true;
        if (typeof specObject.position === 'number') gatePosition = specObject.position;
        if (typeof specObject.width === 'number') gateWidth = specObject.width;
      }

      if (!hasGate) continue;

      this.gapInfo = { type: rect.type, index: rect.index, rect };

      if (rect.type === 'H') {
        const gapStartX = rect.x + (rect.w * gatePosition) / 100 - gateWidth / 2;
        this.gapX = Math.max(rect.x + 5, Math.min(rect.x + rect.w - gateWidth - 5, gapStartX));
        this.gapY = rect.y;
        this.gapWidth = gateWidth;
      } else {
        const gapStartY = rect.y + (rect.h * gatePosition) / 100 - gateWidth / 2;
        this.gapY = Math.max(rect.y + 5, Math.min(rect.y + rect.h - gateWidth - 5, gapStartY));
        this.gapX = rect.x;
        this.gapWidth = gateWidth;
      }
      break;
    }
  }

  getRects(): CollisionRect[] {
    if (!this.gapInfo) return this.rects.map(({ x, y, w, h }) => ({ x, y, w, h }));

    const output: CollisionRect[] = [];
    for (const rect of this.rects) {
      if (rect.index === this.gapInfo.index && rect === this.gapInfo.rect) {
        if (rect.type === 'H') {
          const leftWidth = Math.max(0, this.gapX - rect.x);
          const rightWidth = Math.max(0, rect.x + rect.w - (this.gapX + this.gapWidth));
          if (leftWidth > 0) output.push({ x: rect.x, y: rect.y, w: leftWidth, h: rect.h });
          if (rightWidth > 0) {
            output.push({
              x: this.gapX + this.gapWidth,
              y: rect.y,
              w: rightWidth,
              h: rect.h,
            });
          }
        } else {
          const topHeight = Math.max(0, this.gapY - rect.y);
          const bottomHeight = Math.max(0, rect.y + rect.h - (this.gapY + this.gapWidth));
          if (topHeight > 0) output.push({ x: rect.x, y: rect.y, w: rect.w, h: topHeight });
          if (bottomHeight > 0) {
            output.push({
              x: rect.x,
              y: this.gapY + this.gapWidth,
              w: rect.w,
              h: bottomHeight,
            });
          }
        }
      } else {
        output.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
      }
    }
    return output;
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void {
    if (!this.active) return;

    const rects = this.getRects();
    if (asciiArtEnabled) {
      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const rect of rects) {
        if (rect.w <= 0 || rect.h <= 0) continue;
        if (rect.w > rect.h) {
          const count = Math.max(1, Math.floor(rect.w / 10));
          const ascii = ':'.repeat(count);
          ctx.fillText(
            ascii,
            rect.x - cameraX + rect.w / 2,
            rect.y - cameraY + rect.h / 2
          );
        } else {
          const count = Math.max(1, Math.floor(rect.h / 16));
          for (let i = 0; i < count; i++) {
            ctx.fillText(
              '::',
              rect.x - cameraX + rect.w / 2,
              rect.y - cameraY + (i + 0.5) * (rect.h / count)
            );
          }
        }
      }
    } else {
      ctx.fillStyle = '#5aa2ff';
      for (const rect of rects) {
        if (rect.w > 0 && rect.h > 0) ctx.fillRect(rect.x - cameraX, rect.y - cameraY, rect.w, rect.h);
      }

      if (this.gapInfo) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        if (this.gapInfo.type === 'H') {
          ctx.fillRect(this.gapX - cameraX, this.gapY - cameraY, 1, GATE_THICKNESS);
          ctx.fillRect(
            this.gapX + this.gapWidth - cameraX,
            this.gapY - cameraY,
            1,
            GATE_THICKNESS
          );
        } else {
          ctx.fillRect(this.gapX - cameraX, this.gapY - cameraY, GATE_THICKNESS, 1);
          ctx.fillRect(
            this.gapX - cameraX,
            this.gapY + this.gapWidth - cameraY,
            GATE_THICKNESS,
            1
          );
        }
      }
    }
  }
}

// Predefined gate patterns using the new clear object syntax
export const CONTROLLED_GATE_PATTERNS: ControlledGateDefinition[] = [
  // Simple cases
  { width: 100 }, // Single span

  // S-curve
  [
    { width: 50 },
    { width: 50 }, // Auto S-curve behavior
  ],

  [
    { width: 30 },
    { width: 40 },
    { width: 30 },
  ],

  // Explicit positioning
  [
    { width: 40 },
    { width: 60, y: 120, gate: true },
  ],

  // Vertical segments
  [
    { width: 40 },
    { type: 'vertical', height: 300, gate: { position: 100 } },
    { width: 60 },
  ],

  // Complex with all options
  [
    { width: 30 },
    {
      width: 40,
      x: 10, // x offset as % of canvas
      y: -80, // y offset in pixels
      gate: {
        position: 25, // 25% along segment
        width: 35, // custom gate width
      },
    },
    { width: 30, y: 60 },
  ],

  // Even more explicit using segments property
  {
    segments: [
      { type: 'horizontal', width: 25 },
      {
        type: 'vertical',
        height: 150,
        gate: { position: 30, width: 40 },
      },
      {
        type: 'horizontal',
        width: 75,
        x: -2, // TO-DO should not need this
        y: 0, // relative to end of previous segment
        gate: true, // default centered gate
      },
    ],
  },

  // Mixed formats for variety
  [
    { width: 25, gate: { position: 80 } },
    { width: 50, y: -100 },
    { width: 25, y: 120 },
  ],

  // Another vertical example
  [
    { width: 20 },
    { type: 'vertical', height: 200 },
    { width: 60, gate: true },
    { type: 'vertical', height: 150, gate: { position: 25 } },
    { width: 20, type: 'horizontal' }, // TO-DO
  ],
];

interface ControlledGateGeneratorOptions {
  canvasWidth: number;
  spacingFeet: number;
  createdFeet?: Set<number>;
}

export class ControlledGateGenerator {
  canvasWidth: number;
  spacingFeet: number;
  createdFeet: Set<number>;
  patternIndex = 0;

  constructor({ canvasWidth, spacingFeet, createdFeet = new Set() }: ControlledGateGeneratorOptions) {
    this.canvasWidth = canvasWidth;
    this.spacingFeet = spacingFeet;
    this.createdFeet = createdFeet;
  }

  setCanvasWidth(width: number): void {
    this.canvasWidth = width;
  }

  resetPatternIndex(): void {
    this.patternIndex = 0;
  }

  ensureGates({ spriteY, groundY }: { spriteY: number; groundY: number }): ControlledGate[] {
    if (!Number.isFinite(spriteY) || !Number.isFinite(groundY)) return [];

    const currentFeet = Math.max(0, Math.floor((groundY - spriteY) / PIXELS_PER_FOOT));
    const index = Math.floor(currentFeet / this.spacingFeet);
    const baseFeet = Math.max(this.spacingFeet, index * this.spacingFeet);
    const nextFeet = (index + 1) * this.spacingFeet;

    const gates: ControlledGate[] = [];
    for (const feet of [baseFeet, nextFeet]) {
      const gate = this._createGateAtFeet(feet, groundY);
      if (gate) gates.push(gate);
    }
    return gates;
  }

  private _createGateAtFeet(feet: number, groundY: number): ControlledGate | null {
    if (this.createdFeet.has(feet) || feet <= 0) return null;

    const y = groundY - feet * PIXELS_PER_FOOT;
    const pattern =
      CONTROLLED_GATE_PATTERNS[this.patternIndex % CONTROLLED_GATE_PATTERNS.length];
    this.patternIndex++;

    const gate = new ControlledGate({
      y,
      canvasWidth: this.canvasWidth,
      definition: pattern,
    });

    this.createdFeet.add(feet);
    return gate;
  }
}
