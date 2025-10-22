import { drawGrass } from '../../gui/drawGrass.js';
import { drawBitmap } from '../../gui/drawBitmap.js';
import { getTreePattern, type TreeKey, type TreeVisualStyle } from '../../gui/drawTree.js';
import { drawWell } from '../../gui/drawWell.js';
import { ctx, canvasHeight, canvasWidth, groundY } from '../state/rendering_state.js';
import { drawBubbleField, updateBubbleField, type BubbleEnvironment } from './bubble_field.js';
import { getWellBounds } from './well_layout.js';

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
  90, 
  150, 
  200, 
  230, 
  300, 
  330, 
  390, 
  450
];

const FOREGROUND_TREE_STYLE: TreeVisualStyle = {
  tree: 'tree2',
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

export function drawBackgroundGrid(cameraY: number, timestamp: number): void {
  const groundLineY = groundY - cameraY;

  foregroundTrees.forEach((placement) => {
    drawTreePlacement({
      ...placement,
      y: groundLineY,
    });
  });

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
