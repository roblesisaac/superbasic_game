import {
  GATE_THICKNESS,
  PIXELS_PER_FOOT,
  GATE_GAP_WIDTH,
} from './constants.js';

const DEFAULT_VERTICAL_HEIGHT = 80; // Default height for auto-generated vertical connectors

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

    this._parseDefinition();
    this._generateLayout();
    this._ensureGap();
  }

  update() {}
  startFloating() {}

  _parseDefinition() {
    // Handle simple object case (single segment spanning full width)
    if (this.definition && typeof this.definition === 'object' && !Array.isArray(this.definition)) {
      if (this.definition.segments) {
        // Explicit segments format
        this.segments = this.definition.segments.map(seg => this._normalizeSegment(seg));
      } else {
        // Single segment object
        this.segments = [this._normalizeSegment(this.definition)];
      }
      return;
    }

    // Handle legacy number case (single segment spanning full width)
    if (typeof this.definition === 'number') {
      this.segments = [{
        type: 'horizontal',
        widthPercent: this.definition,
        yOffset: 0,
        xOffset: 0,
        gateSpec: null
      }];
      return;
    }

    // Handle array of segments
    this.segments = [];
    let autoVerticalOffset = 0; // Track cumulative auto-vertical offset for S-curves
    
    for (let i = 0; i < this.definition.length; i++) {
      const segDef = this.definition[i];
      
      if (typeof segDef === 'number') {
        // Legacy number format - simple segment with auto S-curve
        if (i > 0) {
          autoVerticalOffset = autoVerticalOffset === 0 ? DEFAULT_VERTICAL_HEIGHT : -autoVerticalOffset;
        }
        
        this.segments.push({
          type: 'horizontal',
          widthPercent: segDef,
          yOffset: autoVerticalOffset,
          xOffset: 0,
          gateSpec: null
        });
      } else if (typeof segDef === 'object') {
        // New object format
        const normalized = this._normalizeSegment(segDef);
        
        // Apply auto S-curve behavior if no explicit y offset
        if (i > 0 && normalized.yOffset === 0 && normalized.type === 'horizontal') {
          autoVerticalOffset = autoVerticalOffset === 0 ? DEFAULT_VERTICAL_HEIGHT : -autoVerticalOffset;
          normalized.yOffset = autoVerticalOffset;
        } else if (normalized.yOffset !== 0) {
          autoVerticalOffset = normalized.yOffset;
        }
        
        this.segments.push(normalized);
      } else if (Array.isArray(segDef)) {
        // Legacy array format: [segWidth, yXPos, gateSpecs, isVerticalSegment]
        const [widthPercent, yXPos, gateSpecs, isVertical] = segDef;
        
        let yOffset = 0;
        let xOffset = 0;
        
        // Parse yXPos
        if (typeof yXPos === 'number') {
          yOffset = yXPos;
          autoVerticalOffset = yOffset;
        } else if (Array.isArray(yXPos) && yXPos.length >= 2) {
          [yOffset, xOffset] = yXPos;
          autoVerticalOffset = yOffset;
        } else if (yXPos === null || yXPos === undefined) {
          // Use auto S-curve behavior
          if (i > 0) {
            autoVerticalOffset = autoVerticalOffset === 0 ? DEFAULT_VERTICAL_HEIGHT : -autoVerticalOffset;
            yOffset = autoVerticalOffset;
          }
        }
        
        this.segments.push({
          type: isVertical ? 'vertical' : 'horizontal',
          widthPercent: widthPercent || 50,
          heightPixels: isVertical ? widthPercent : undefined,
          yOffset,
          xOffset: (xOffset / 100) * this.canvasWidth, // Convert percentage to pixels
          gateSpec: gateSpecs
        });
      }
    }
  }

  _normalizeSegment(segment) {
    const normalized = {
      type: segment.type || 'horizontal',
      widthPercent: 50,
      heightPixels: undefined,
      yOffset: segment.y || 0,
      xOffset: segment.x ? (segment.x / 100) * this.canvasWidth : 0, // Convert percentage to pixels
      gateSpec: segment.gate || null
    };

    if (normalized.type === 'horizontal') {
      normalized.widthPercent = segment.width || 50;
    } else if (normalized.type === 'vertical') {
      normalized.heightPixels = segment.height || DEFAULT_VERTICAL_HEIGHT;
      normalized.widthPercent = GATE_THICKNESS; // Vertical segments use thickness as width
    }

    return normalized;
  }

  _generateLayout() {
    this.rects = [];
    let cursorX = 0;
    let currentY = this.y;

    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];
      
      if (segment.type === 'vertical') {
        // Vertical segment - use heightPixels as height
        const height = segment.heightPixels || DEFAULT_VERTICAL_HEIGHT;
        const targetY = currentY + height; // Vertical segments extend from current position
        
        const rect = {
          type: 'V',
          index: i,
          x: cursorX - GATE_THICKNESS / 2, // Position at end of previous horizontal segment
          y: currentY - GATE_THICKNESS / 2,
          w: GATE_THICKNESS,
          h: height,
          segment: segment
        };
        this.rects.push(rect);
        
        // Update Y position for next segment (vertical segments change Y)
        currentY = targetY;
        // Don't advance cursorX for vertical segments
      } else {
        // Horizontal segment
        const segmentWidth = (this.canvasWidth * segment.widthPercent / 100);
        const targetY = currentY + segment.yOffset;
        
        // Add connecting vertical segment if there's a Y offset and this isn't the first segment
        if (segment.yOffset !== 0 && i > 0) {
          const connectorRect = {
            type: 'V',
            index: `${i-1}-to-${i}-connector`,
            x: cursorX - GATE_THICKNESS / 2,
            y: Math.min(currentY, targetY) - GATE_THICKNESS / 2,
            w: GATE_THICKNESS,
            h: Math.abs(targetY - currentY) + GATE_THICKNESS,
            segment: null // No gap allowed in connectors
          };
          this.rects.push(connectorRect);
        }

        // Apply X offset
        const xPosition = cursorX + segment.xOffset;

        const rect = {
          type: 'H',
          index: i,
          x: xPosition,
          y: targetY - GATE_THICKNESS / 2,
          w: segmentWidth,
          h: GATE_THICKNESS,
          segment: segment
        };
        this.rects.push(rect);

        // Update cursor position for next segment
        cursorX = xPosition + segmentWidth;
        currentY = targetY;
      }
    }
  }

  _ensureGap() {
    // Find segments that explicitly request gates
    const segmentsWithGates = this.segments.filter(seg => seg.gateSpec);
    
    if (segmentsWithGates.length === 0) {
      // No explicit gates - place one in the first suitable horizontal segment
      const firstHorizontalSegment = this.segments.find(seg => seg.type !== 'vertical');
      if (firstHorizontalSegment) {
        firstHorizontalSegment.gateSpec = true;
      }
    }

    // Process gate specifications
    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];
      if (!segment.gateSpec) continue;

      const rect = this.rects.find(r => r.index === i && r.segment === segment);
      if (!rect) continue;

      // Parse gate specification
      let hasGate = false;
      let gatePosition = 50; // Default to center (percentage)
      let gateWidth = GATE_GAP_WIDTH;

      if (segment.gateSpec === true) {
        hasGate = true;
      } else if (typeof segment.gateSpec === 'object') {
        hasGate = true;
        if (typeof segment.gateSpec.position === 'number') {
          gatePosition = segment.gateSpec.position;
        }
        if (typeof segment.gateSpec.width === 'number') {
          gateWidth = segment.gateSpec.width;
        }
      } else if (Array.isArray(segment.gateSpec)) {
        // Legacy array format: [hasGateSpec, posSpec, widthSpec]
        const [hasGateSpec, posSpec, widthSpec] = segment.gateSpec;
        hasGate = Boolean(hasGateSpec);
        if (typeof posSpec === 'number') gatePosition = posSpec;
        if (typeof widthSpec === 'number') gateWidth = widthSpec;
      }

      if (hasGate) {
        this.gapInfo = {
          type: rect.type,
          index: i,
          rect: rect
        };

        if (rect.type === 'H') {
          // Horizontal gap
          const gapStartX = rect.x + (rect.w * gatePosition / 100) - (gateWidth / 2);
          this.gapX = Math.max(rect.x + 5, Math.min(rect.x + rect.w - gateWidth - 5, gapStartX));
          this.gapY = rect.y;
          this.gapWidth = gateWidth;
        } else {
          // Vertical gap
          const gapStartY = rect.y + (rect.h * gatePosition / 100) - (gateWidth / 2);
          this.gapY = Math.max(rect.y + 5, Math.min(rect.y + rect.h - gateWidth - 5, gapStartY));
          this.gapX = rect.x;
          this.gapWidth = gateWidth;
        }
        break; // Only create one gap per gate
      }
    }
  }

  getRects() {
    if (!this.gapInfo) return this.rects;

    const output = [];
    
    for (const rect of this.rects) {
      if (this.gapInfo && rect.index === this.gapInfo.index && rect === this.gapInfo.rect) {
        // Split this rect to create the gap
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

    // Draw gap indicators
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

// Predefined gate patterns using the new clear object syntax
export const CONTROLLED_GATE_PATTERNS = [
  // Simple cases
  { width: 100 }, // Single span
  
  // S-curve
  [
    { width: 50 },
    { width: 50 } // Auto S-curve behavior
  ],
  
  [
    { width: 30 },
    { width: 40 },
    { width: 30 }
  ],
  
  // Explicit positioning
  [
    { width: 40 },
    { width: 60, y: 120, gate: true }
  ],
  
  // Vertical segments
  [
    { width: 40 },
    { type: 'vertical', height: 300, gate: { position: 100 } },
    { width: 60 }
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
        width: 35 // custom gate width
      }
    },
    { width: 30, y: 60 }
  ],
  
  // Even more explicit using segments property
  {
    segments: [
      { type: 'horizontal', width: 25 },
      { 
        type: 'vertical', 
        height: 150, 
        gate: { position: 30, width: 40 }
      },
      { 
        type: 'horizontal', 
        width: 75, 
        x: -2, // TO-DO should not need this
        y: 0, // relative to end of previous segment
        gate: true // default centered gate
      }
    ]
  },
  
  // Mixed formats for variety
  [
    { width: 25, gate: { position: 80 } },
    { width: 50, y: -100 },
    { width: 25, y: 120 }
  ],
  
  // Another vertical example
  [
    { width: 20 },
    { type: 'vertical', height: 200 },
    { width: 60, gate: true },
    { type: 'vertical', height: 150, gate: { position: 25 } },
    { width: 20, type: 'horizontal' } // TO-DO 
  ]
];

export class ControlledGateGenerator {
  constructor({ canvasWidth, spacingFeet, createdFeet = new Set() }) {
    this.canvasWidth = canvasWidth;
    this.spacingFeet = spacingFeet;
    this.createdFeet = createdFeet;
    this.patternIndex = 0;
  }

  setCanvasWidth(width) {
    this.canvasWidth = width;
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
    
    // Cycle through patterns
    const pattern = CONTROLLED_GATE_PATTERNS[this.patternIndex % CONTROLLED_GATE_PATTERNS.length];
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