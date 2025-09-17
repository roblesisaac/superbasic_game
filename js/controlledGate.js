import {
  GATE_THICKNESS,
  GATE_GAP_WIDTH
} from './constants.js';

const DEFAULT_VERTICAL_SHIFT = Math.round(GATE_GAP_WIDTH * 2);
const LARGE_VERTICAL_SHIFT = Math.round(DEFAULT_VERTICAL_SHIFT * 1.3);
const EPSILON = 0.0001;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clampPercent = value => clamp(Number.isFinite(value) ? value : 0, 0, 100);

function normalizeOffsets(value) {
  if (Array.isArray(value)) {
    const [yOffsetRaw, xOffsetRaw] = value;
    const yOffset = typeof yOffsetRaw === 'number' ? yOffsetRaw : 0;
    const xOffset = typeof xOffsetRaw === 'number' ? xOffsetRaw : 0;
    return { yOffset, xOffsetPercent: xOffset };
  }
  if (typeof value === 'number') {
    return { yOffset: value, xOffsetPercent: 0 };
  }
  if (value && typeof value === 'object') {
    const { y, x } = value;
    const yOffset = typeof y === 'number' ? y : 0;
    const xOffset = typeof x === 'number' ? x : 0;
    return { yOffset, xOffsetPercent: xOffset };
  }
  return { yOffset: 0, xOffsetPercent: 0 };
}

function normalizeGateSpec(spec) {
  if (Array.isArray(spec)) {
    const [hasGateRaw, positionRaw = 50, widthRaw = null] = spec;
    const hasGate = Boolean(hasGateRaw);
    const positionPercent = hasGate ? clampPercent(positionRaw ?? 50) : null;
    const width = hasGate && typeof widthRaw === 'number' ? widthRaw : null;
    return { hasGate, positionPercent, width, explicit: true };
  }

  if (spec === true) {
    return { hasGate: true, positionPercent: 50, width: null, explicit: true };
  }

  if (spec === false) {
    return { hasGate: false, positionPercent: null, width: null, explicit: true };
  }

  if (spec == null) {
    return { hasGate: false, positionPercent: null, width: null, explicit: false };
  }

  if (typeof spec === 'object') {
    const hasGate = Boolean(spec.hasGate ?? spec.enabled ?? true);
    const positionPercent = hasGate ? clampPercent(spec.position ?? spec.pos ?? 50) : null;
    const width = hasGate && typeof spec.width === 'number' ? spec.width : null;
    return { hasGate, positionPercent, width, explicit: true };
  }

  const hasGate = Boolean(spec);
  return { hasGate, positionPercent: hasGate ? 50 : null, width: null, explicit: true };
}

function normalizeSegment(definition, index) {
  if (typeof definition === 'number') {
    return {
      index,
      isVertical: false,
      length: definition,
      ...normalizeOffsets(null),
      gate: normalizeGateSpec(null)
    };
  }

  if (!Array.isArray(definition) || definition.length === 0) return null;

  const [rawLength, rawPosition, rawGateSpec, rawIsVertical] = definition;

  let yXPos = rawPosition;
  let gateSpec = rawGateSpec;
  let isVertical = Boolean(rawIsVertical);

  // Allow short forms like [width, gateSpec]
  if (definition.length === 2 && (typeof rawPosition === 'boolean' || rawPosition == null)) {
    gateSpec = rawPosition;
    yXPos = null;
    isVertical = false;
  } else if (
    definition.length === 3 &&
    (typeof rawPosition === 'boolean' || (Array.isArray(rawPosition) && typeof rawPosition[0] === 'boolean'))
  ) {
    gateSpec = rawPosition;
    yXPos = rawGateSpec;
    isVertical = Boolean(rawIsVertical);
  }

  const { yOffset, xOffsetPercent } = normalizeOffsets(yXPos);
  const gate = normalizeGateSpec(gateSpec);

  return {
    index,
    isVertical,
    length: typeof rawLength === 'number' ? rawLength : 0,
    yOffset,
    xOffsetPercent,
    gate
  };
}

function assignDefaultGate(segments) {
  if (segments.some(segment => segment.gate.hasGate)) return;
  const fallback = segments.find(segment => !segment.isVertical) ?? segments[0];
  if (!fallback) return;
  fallback.gate = {
    hasGate: true,
    positionPercent: 50,
    width: null,
    explicit: false
  };
}

function connectPoints(from, to, thickness, pushRect) {
  let current = { ...from };

  const deltaX = to.x - current.x;
  if (Math.abs(deltaX) > EPSILON) {
    const width = Math.abs(deltaX);
    const x = Math.min(current.x, to.x);
    const rect = {
      type: 'H',
      x,
      y: current.y - thickness / 2,
      w: width,
      h: thickness
    };
    pushRect(rect);
    current.x = to.x;
  }

  const deltaY = to.y - current.y;
  if (Math.abs(deltaY) > EPSILON) {
    const height = Math.abs(deltaY);
    const rect = {
      type: 'V',
      x: current.x - thickness / 2,
      y: Math.min(current.y, to.y) - thickness / 2,
      w: thickness,
      h: height + thickness
    };
    pushRect(rect);
    current.y = to.y;
  }

  return current;
}

function computeStart(previousEnd, segment, canvasWidth) {
  const xOffset = (segment.xOffsetPercent / 100) * canvasWidth;
  const yOffset = segment.yOffset;
  return {
    x: previousEnd.x + xOffset,
    y: previousEnd.y - yOffset
  };
}

function createHorizontalSegment(segment, start, options) {
  const { canvasWidth, thickness, defaultGapWidth, pushRect } = options;
  const width = (segment.length / 100) * canvasWidth;
  const safeWidth = Math.max(0, width);
  const rect = {
    type: 'H',
    x: start.x,
    y: start.y - thickness / 2,
    w: safeWidth,
    h: thickness
  };
  const assignedRect = pushRect(rect);
  const end = { x: start.x + safeWidth, y: start.y };

  let gap = null;
  if (segment.gate.hasGate) {
    const gateWidth = segment.gate.width ?? defaultGapWidth;
    const available = Math.max(0, safeWidth - gateWidth);
    const percent = segment.gate.positionPercent ?? 50;
    const targetOffset = (clampPercent(percent) / 100) * safeWidth;
    const gapOffset = clamp(targetOffset, 0, available);
    const gapX = Math.max(rect.x, Math.min(rect.x + safeWidth - gateWidth, rect.x + gapOffset));
    gap = {
      info: { type: 'H', index: assignedRect.index },
      x: gapX,
      y: rect.y,
      width: gateWidth
    };
  }

  return { end, gap };
}

function createVerticalSegment(segment, start, options) {
  const { thickness, defaultGapWidth, pushRect } = options;
  const length = segment.length;
  const direction = length >= 0 ? 1 : -1;
  const height = Math.abs(length);
  const rect = {
    type: 'V',
    x: start.x - thickness / 2,
    y: direction >= 0 ? start.y - thickness / 2 : start.y + length - thickness / 2,
    w: thickness,
    h: height + thickness
  };
  const assignedRect = pushRect(rect);
  const end = { x: start.x, y: start.y + length };

  let gap = null;
  if (segment.gate.hasGate) {
    const gateWidth = segment.gate.width ?? defaultGapWidth;
    const available = Math.max(0, height - gateWidth);
    const percent = segment.gate.positionPercent ?? 50;
    const targetOffset = (clampPercent(percent) / 100) * height;
    const gapOffset = clamp(targetOffset, 0, available);
    const top = Math.min(start.y, end.y);
    const gapY = Math.max(top, Math.min(top + height - gateWidth, top + gapOffset));
    gap = {
      info: { type: 'V', index: assignedRect.index },
      x: rect.x,
      y: gapY,
      width: gateWidth
    };
  }

  return { end, gap };
}

function buildFallbackLayout({ y, canvasWidth, defaultGapWidth }) {
  const rect = {
    type: 'H',
    index: 0,
    x: 0,
    y: y - GATE_THICKNESS / 2,
    w: canvasWidth,
    h: GATE_THICKNESS
  };
  const gapWidth = Math.min(defaultGapWidth, Math.max(0, rect.w));
  const gapX = Math.max(0, rect.x + (rect.w - gapWidth) / 2);
  return {
    rects: [rect],
    gapInfo: { type: 'H', index: rect.index },
    gapX,
    gapY: rect.y,
    gapWidth
  };
}

function buildControlledGateLayout(pattern, { y, canvasWidth, defaultGapWidth }) {
  const segmentDefs = Array.isArray(pattern) ? pattern : [pattern];
  const segments = segmentDefs
    .map((definition, index) => normalizeSegment(definition, index))
    .filter(Boolean);

  if (segments.length === 0) {
    return buildFallbackLayout({ y, canvasWidth, defaultGapWidth });
  }

  assignDefaultGate(segments);

  const rects = [];
  let horizontalIndex = 0;
  let verticalIndex = 0;

  const pushRect = rect => {
    if (rect.type === 'H') {
      rect.index = horizontalIndex++;
    } else if (rect.type === 'V') {
      rect.index = verticalIndex++;
    }
    rects.push(rect);
    return rect;
  };

  let cursor = { x: 0, y };
  let activeGap = null;

  segments.forEach(segment => {
    const start = computeStart(cursor, segment, canvasWidth);
    cursor = connectPoints(cursor, start, GATE_THICKNESS, pushRect);

    const createSegment = segment.isVertical ? createVerticalSegment : createHorizontalSegment;
    const { end, gap } = createSegment(segment, cursor, {
      canvasWidth,
      thickness: GATE_THICKNESS,
      defaultGapWidth,
      pushRect
    });

    if (!activeGap && gap) {
      activeGap = gap;
    }

    cursor = end;
  });

  if (!activeGap) {
    return buildFallbackLayout({ y, canvasWidth, defaultGapWidth });
  }

  return {
    rects,
    gapInfo: activeGap.info,
    gapX: activeGap.x,
    gapY: activeGap.y,
    gapWidth: activeGap.width ?? defaultGapWidth
  };
}

export const CONTROLLED_GATE_PATTERNS = [
  100,
  [
    50,
    [50, DEFAULT_VERTICAL_SHIFT, [true, 55]]
  ],
  [
    40,
    [30, DEFAULT_VERTICAL_SHIFT],
    [30, -DEFAULT_VERTICAL_SHIFT, [true, 30]]
  ],
  [
    35,
    [30, [DEFAULT_VERTICAL_SHIFT, 6]],
    [32, [-DEFAULT_VERTICAL_SHIFT, -4], [true, 60]]
  ],
  [
    30,
    [LARGE_VERTICAL_SHIFT, null, null, true],
    [30, null, [true, 45]],
    [40, [LARGE_VERTICAL_SHIFT, 0]]
  ],
  [
    25,
    [30, [DEFAULT_VERTICAL_SHIFT, 10]],
    [40, [-DEFAULT_VERTICAL_SHIFT, -5], [true, 45]],
    [35, [DEFAULT_VERTICAL_SHIFT, 0]]
  ]
];

export class ControlledGate {
  constructor({ y, canvasWidth, gapWidth = GATE_GAP_WIDTH, pattern }) {
    this.y = y;
    this.canvasWidth = canvasWidth;
    this.gapWidth = gapWidth;

    this.active = true;
    this.floating = false;
    this.speed = 0;
    this.direction = 0;
    this.originalSpeed = 0;

    const layout = buildControlledGateLayout(pattern, {
      y,
      canvasWidth,
      defaultGapWidth: gapWidth
    });

    this.rects = layout.rects;
    this.gapInfo = layout.gapInfo;
    this.gapX = layout.gapX;
    this.gapY = layout.gapY;
    this.gapWidth = layout.gapWidth ?? this.gapWidth;
  }

  update() {}

  startFloating() {}

  getRects() {
    const output = [];

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

  draw(ctx, cameraY) {
    if (!this.active) return;

    ctx.fillStyle = '#5aa2ff';
    for (const rect of this.getRects()) {
      if (rect.w > 0 && rect.h > 0) ctx.fillRect(rect.x, rect.y - cameraY, rect.w, rect.h);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    if (this.gapInfo?.type === 'H') {
      const gapY = this.gapY;
      ctx.fillRect(this.gapX, gapY - cameraY, 1, GATE_THICKNESS);
      ctx.fillRect(this.gapX + this.gapWidth, gapY - cameraY, 1, GATE_THICKNESS);
    } else if (this.gapInfo?.type === 'V') {
      const gapX = this.gapX;
      ctx.fillRect(gapX, this.gapY - cameraY, GATE_THICKNESS, 1);
      ctx.fillRect(gapX, this.gapY + this.gapWidth - cameraY, GATE_THICKNESS, 1);
    }
  }
}
