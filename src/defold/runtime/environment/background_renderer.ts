import { drawGrass } from '../../gui/drawGrass.js';
import { drawBitmap } from '../../gui/drawBitmap.js';
import { getTreePattern, type TreeKey, type TreeVisualStyle } from '../../gui/drawTree.js';
import { drawWell } from '../../gui/drawWell.js';
import { ctx, canvasHeight, canvasWidth, groundY } from '../state/rendering_state.js';
import { drawBubbleField, updateBubbleField, type BubbleEnvironment } from './bubble_field.js';
import { getWellBounds } from './well_layout.js';
import { CABIN_BITMAP } from '../../modules/bitmaps/cabin.js';
import { drawRollingHills } from '../../gui/drawRollingHills.js';

interface TreePlacement {
  x: number;
  y: number;
  align?: 'top-left' | 'center' | 'bottom';
  style: TreeVisualStyle;
}

type NormalizedTreeStyle = {
  tree: TreeKey;
  pixelSize: number;
  alpha: number;
  widthScale: number;
  heightScale: number;
  brighten: number;
  darken: number;
};

const FOREGROUND_TREE_POSITIONS = [30,
  // 90, 
  150, 
  // 200, 
  // 230, 
  // 300, 
  360, 
  390, 
  // 450
];

const FOREGROUND_TREE_STYLE: TreeVisualStyle = {
  tree: 'tree1',
  heightScale: 1.7
};

const FEATURE_TREE_STYLE: TreeVisualStyle = {
  tree: 'tree2',
  pixelSize: 1.5,
  heightScale: 1.5,
};

const foregroundTrees = FOREGROUND_TREE_POSITIONS.map((x) => ({
  x,
  align: 'bottom' as const,
  style: {
    ...FOREGROUND_TREE_STYLE,
    darken: 0.5 + Math.random() * 0.2,
    pixelSize: 0.6 + Math.random() * 0.2,
  },
}));

const FEATURE_TREE_X = 110;

const DEFAULT_TREE_KEY: TreeKey = 'tree1';

const CABIN_COLOR_MAP: Record<string, string> = {
  '1': '#222222',
  '2': '#4c4c4c',
  '3': '#333333',
  '5': '#999999',
  '7': '#222222',
};

const CABIN_DEFAULT_COLOR = CABIN_COLOR_MAP['2'];
const CABIN_WIDTH_SCALE = 1;
const CABIN_HEIGHT_SCALE = 1.5;
const CABIN_COLS = CABIN_BITMAP.reduce((max, line) => Math.max(max, line.length), 0);

function clamp01(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value as number));
}

function ensurePositive(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return value > 0 ? (value as number) : fallback;
}

function normalizeTreeStyle(style: TreeVisualStyle = {}): NormalizedTreeStyle {
  const {
    tree = DEFAULT_TREE_KEY,
    pixelSize,
    alpha,
    widthScale,
    heightScale,
    brighten,
    darken,
  } = style;

  return {
    tree,
    pixelSize: ensurePositive(pixelSize, 4),
    alpha: clamp01(alpha, 1),
    widthScale: ensurePositive(widthScale, 1),
    heightScale: ensurePositive(heightScale, 1.5),
    brighten: clamp01(brighten, 0),
    darken: clamp01(darken, 0),
  };
}

function drawTreePlacement(request: TreePlacement): void {
  const normalized = normalizeTreeStyle(request.style);
  let pattern = getTreePattern(normalized.tree);

  if (!pattern.length && normalized.tree !== DEFAULT_TREE_KEY) {
    pattern = getTreePattern(DEFAULT_TREE_KEY);
  }
  if (!pattern.length) return;

  void drawBitmap(ctx, {
    pattern,
    x: request.x,
    y: request.y,
    align: request.align ?? 'bottom',
    pixelSize: normalized.pixelSize,
    alpha: normalized.alpha,
    widthScale: normalized.widthScale,
    heightScale: normalized.heightScale,
    brighten: normalized.brighten,
    darken: normalized.darken,
  });
}

function drawCabin(groundLineY: number): void {
  if (CABIN_COLS === 0) return;

  const cabinX = 270;

  void drawBitmap(ctx, {
    pattern: CABIN_BITMAP,
    x: cabinX,
    y: groundLineY,
    align: 'bottom',
    pixelSize: 1.5,
    widthScale: CABIN_WIDTH_SCALE,
    heightScale: CABIN_HEIGHT_SCALE,
    colorMap: CABIN_COLOR_MAP,
    defaultColor: CABIN_DEFAULT_COLOR,
  });
}

export function drawBackgroundGrid(cameraY: number, timestamp: number): void {
  const groundLineY = groundY - cameraY;

  drawRollingHills(ctx, {
    width: canvasWidth,
    groundY: groundLineY,
    cameraY,
  });

  foregroundTrees.forEach((placement) => {
    drawTreePlacement({
      ...placement,
      y: groundLineY,
    });
  });

  drawCabin(groundLineY);

  drawTreePlacement({
    x: FEATURE_TREE_X,
    y: groundLineY,
    align: 'bottom',
    style: FEATURE_TREE_STYLE,
  });

  drawGrass(ctx, {
    width: canvasWidth,
    groundY,
    cameraY,
  });

  const well = getWellBounds(canvasWidth);
  const bubbleEnv: BubbleEnvironment = {
    timestamp,
    cameraY,
    canvasHeight,
    canvasWidth,
    groundY,
    wellBounds: well,
  };

  updateBubbleField(bubbleEnv);

  drawWell(ctx, {
    centerX: well.centerX,
    groundY,
    cameraY,
    canvasHeight,
    openingWidth: well.openingWidth,
  });

  drawBubbleField(ctx, bubbleEnv);
}
