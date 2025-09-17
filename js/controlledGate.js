import {
  GATE_THICKNESS,
  PIXELS_PER_FOOT,
  GATE_EVERY_FEET,
  GATE_GAP_WIDTH
} from './constants.js';

export class ControlledGate {
  constructor({ y, canvasWidth, definition }) {
    this.y = y;
    this.canvasWidth = canvasWidth;
    this.definition = definition;
    this.active = true;
    this.floating = false;
    this.speed = 0;
    this.direction = 0;
    this.originalSpeed = 0;

    this.rects = [];
    this.gapInfo = null;
    this.gapX = 0;
    this.gapY = 0;
    this.gapWidth = GATE_GAP_WIDTH;

    this._parseDefinition();
    this._generateLayout();
    this._ensureGap();
  }

  update() {}

  startFloating() {}

  _parseDefinition() {
    if (typeof this.definition === 'number') {
      this.segments = [{
        widthPercent: this.definition,
        yOffset: 0,
        xOffset: 0,
        gateSpec: null,
        isVertical: false
      }];
      return;
    }

    this.segments = [];
    if (!Array.isArray(this.definition)) return;

    for (const segDef of this.definition) {
      if (typeof segDef === 'number') {
        this.segments.push({
          widthPercent: segDef,
          yOffset: 0,
          xOffset: 0,
          gateSpec: null,
          isVertical: false
        });
      } else if (Array.isArray(segDef)) {
        const [widthPercent, yXPos, gateSpecs, isVertical] = segDef;

        let yOffset = 0;
        let xOffset = 0;

        if (typeof yXPos === 'number') {
          yOffset = yXPos;
        } else if (Array.isArray(yXPos) && yXPos.length >= 2) {
          [yOffset, xOffset] = yXPos;
        }

        this.segments.push({
          widthPercent: typeof widthPercent === 'number' ? widthPercent : 50,
          yOffset,
          xOffset,
          gateSpec: gateSpecs,
          isVertical: Boolean(isVertical)
        });
      }
    }

    if (this.segments.length === 0) {
      this.segments.push({
        widthPercent: 100,
        yOffset: 0,
        xOffset: 0,
        gateSpec: null,
        isVertical: false
      });
    }
  }

  _generateLayout() {
    this.rects = [];
    let cursorX = 0;
    let currentY = this.y;

    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];

      const segmentWidth = segment.isVertical
        ? GATE_THICKNESS
        : (this.canvasWidth * segment.widthPercent) / 100;

      const yPosition = currentY + segment.yOffset;
      const xPosition = cursorX + (this.canvasWidth * segment.xOffset) / 100;

      if (segment.isVertical) {
        const height = Math.abs(segment.yOffset) || 60;
        const rect = {
          type: 'V',
          index: i,
          x: xPosition - GATE_THICKNESS / 2,
          y: Math.min(currentY, yPosition) - GATE_THICKNESS / 2,
          w: GATE_THICKNESS,
          h: height + GATE_THICKNESS,
          segment
        };
        this.rects.push(rect);
      } else {
        const rect = {
          type: 'H',
          index: i,
          x: xPosition,
          y: yPosition - GATE_THICKNESS / 2,
          w: segmentWidth,
          h: GATE_THICKNESS,
          segment
        };
        this.rects.push(rect);

        if (i < this.segments.length - 1 && !this.segments[i + 1].isVertical) {
          const nextSegment = this.segments[i + 1];
          const nextY = yPosition + nextSegment.yOffset;

          if (Math.abs(nextY - yPosition) > 5) {
            const connectorX = xPosition + segmentWidth;
            const connectorRect = {
              type: 'V',
              index: `${i}-connector`,
              x: connectorX - GATE_THICKNESS / 2,
              y: Math.min(yPosition, nextY) - GATE_THICKNESS / 2,
              w: GATE_THICKNESS,
              h: Math.abs(nextY - yPosition) + GATE_THICKNESS,
              segment: null
            };
            this.rects.push(connectorRect);
          }
        }
      }

      cursorX = segment.isVertical ? cursorX : xPosition + segmentWidth;
      currentY = yPosition;
    }
  }

  _ensureGap() {
    const segmentsWithGates = this.segments?.filter(seg => seg.gateSpec) ?? [];

    if (segmentsWithGates.length === 0) {
      const firstHorizontalSegment = this.segments?.find(seg => !seg.isVertical);
      if (firstHorizontalSegment) {
        firstHorizontalSegment.gateSpec = true;
      }
    }

    for (let i = 0; i < (this.segments?.length ?? 0); i++) {
      const segment = this.segments[i];
      if (!segment?.gateSpec) continue;

      const rect = this.rects.find(r => r.index === i && r.segment === segment);
      if (!rect) continue;

      let hasGate = false;
      let gatePosition = 50;
      let gateWidth = GATE_GAP_WIDTH;

      if (segment.gateSpec === true) {
        hasGate = true;
      } else if (Array.isArray(segment.gateSpec)) {
        const [hasGateSpec, posSpec, widthSpec] = segment.gateSpec;
        hasGate = Boolean(hasGateSpec);
        if (typeof posSpec === 'number') gatePosition = posSpec;
        if (typeof widthSpec === 'number') gateWidth = widthSpec;
      }

      if (hasGate) {
        this.gapInfo = {
          type: rect.type,
          index: i,
          rect
        };

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
  }

  getRects() {
    if (!this.gapInfo) return this.rects;

    const output = [];

    for (const rect of this.rects) {
      if (this.gapInfo && rect.index === this.gapInfo.index && rect === this.gapInfo.rect) {
        if (rect.type === 'H') {
          const leftWidth = Math.max(0, this.gapX - rect.x);
          const rightWidth = Math.max(0, rect.x + rect.w - (this.gapX + this.gapWidth));

          if (leftWidth > 0) {
            output.push({ x: rect.x, y: rect.y, w: leftWidth, h: rect.h });
          }
          if (rightWidth > 0) {
            output.push({
              x: this.gapX + this.gapWidth,
              y: rect.y,
              w: rightWidth,
              h: rect.h
            });
          }
        } else {
          const topHeight = Math.max(0, this.gapY - rect.y);
          const bottomHeight = Math.max(0, rect.y + rect.h - (this.gapY + this.gapWidth));

          if (topHeight > 0) {
            output.push({ x: rect.x, y: rect.y, w: rect.w, h: topHeight });
          }
          if (bottomHeight > 0) {
            output.push({
              x: rect.x,
              y: this.gapY + this.gapWidth,
              w: rect.w,
              h: bottomHeight
            });
          }
        }
      } else {
        output.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
      }
    }

    return output;
  }

  draw(ctx, cameraY) {
    if (!this.active) return;

    ctx.fillStyle = '#5aa2ff';
    for (const rect of this.getRects()) {
      if (rect.w > 0 && rect.h > 0) {
        ctx.fillRect(rect.x, rect.y - cameraY, rect.w, rect.h);
      }
    }

    if (this.gapInfo) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      if (this.gapInfo.type === 'H') {
        ctx.fillRect(this.gapX, this.gapY - cameraY, 1, GATE_THICKNESS);
        ctx.fillRect(this.gapX + this.gapWidth, this.gapY - cameraY, 1, GATE_THICKNESS);
      } else {
        ctx.fillRect(this.gapX, this.gapY - cameraY, GATE_THICKNESS, 1);
        ctx.fillRect(this.gapX, this.gapY + this.gapWidth - cameraY, GATE_THICKNESS, 1);
      }
    }
  }
}

export const CONTROLLED_GATE_PATTERNS = [
  100,
  [50, 50],
  [30, 40, 30],
  [40, [60, null, true]],
  [50, [50, null, [true, 25]]],
  [25, [50, 80], [25, -40]],
  [20, [30, 100], [50, [-150, 10], true]],
  [30, [0, null, null, true], [70]],
  [25, [0, 60, null, true], [50, null, true], [25]]
];

export class ControlledGateGenerator {
  constructor({ canvasWidth, spacingFeet = GATE_EVERY_FEET, createdFeet = new Set() }) {
    this.canvasWidth = canvasWidth;
    this.spacingFeet = spacingFeet;
    this.createdFeet = createdFeet;
    this.patternIndex = 0;
  }

  setCanvasWidth(width) {
    this.canvasWidth = width;
  }

  resetPatternIndex() {
    this.patternIndex = 0;
  }

  ensureGates({ spriteY, groundY }) {
    if (typeof spriteY !== 'number' || typeof groundY !== 'number') return [];

    const currentFeet = Math.max(0, Math.floor((groundY - spriteY) / PIXELS_PER_FOOT));
    const index = Math.floor(currentFeet / this.spacingFeet);
    const baseFeet = Math.max(this.spacingFeet, index * this.spacingFeet);
    const nextFeet = (index + 1) * this.spacingFeet;

    const gates = [];
    for (const feet of [baseFeet, nextFeet]) {
      const gate = this._createGateAtFeet(feet, groundY);
      if (gate) gates.push(gate);
    }
    return gates;
  }

  _createGateAtFeet(feet, groundY) {
    if (this.createdFeet.has(feet) || feet <= 0) return null;

    const y = groundY - feet * PIXELS_PER_FOOT;

    const patterns = CONTROLLED_GATE_PATTERNS.length ? CONTROLLED_GATE_PATTERNS : [100];
    const pattern = patterns[this.patternIndex % patterns.length];
    this.patternIndex++;

    const gate = new ControlledGate({
      y,
      canvasWidth: this.canvasWidth,
      definition: pattern
    });

    this.createdFeet.add(feet);
    return gate;
  }
}
