import { drawGrass } from '../../gui/drawGrass.js';
import { createTreeBitmap, type TreeVisualStyle } from '../../gui/drawTree.js';
import { drawWell } from '../../gui/drawWell.js';
import { ctx, canvasHeight, canvasWidth, groundY } from '../state/rendering_state.js';
import { drawBubbleField, updateBubbleField, type BubbleEnvironment } from './bubble_field.js';
import { getWellBounds } from './well_layout.js';

type TreeBitmap = ReturnType<typeof createTreeBitmap>;

interface TreePlacement {
  x: number;
  y: number;
  align?: 'top-left' | 'center' | 'bottom';
  style: TreeVisualStyle;
}

type TreeBitmapKey = string;

const treeBitmapCache = new Map<TreeBitmapKey, TreeBitmap>();

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
    darken: 0.7 + Math.random() * 0.2,
    pixelSize: 0.6 + Math.random() * 0.2,
  },
}));

const FEATURE_TREE_X = 110;

function makeTreeKey(style: TreeVisualStyle): TreeBitmapKey {
  return JSON.stringify({
    tree: style.tree ?? 'tree1',
    pixelSize: style.pixelSize ?? 4,
    widthScale: style.widthScale ?? 1,
    heightScale: style.heightScale ?? 1.5,
    brighten: style.brighten ?? 0,
    darken: style.darken ?? 0,
    alpha: style.alpha ?? 1,
  });
}

function getTreeBitmap(style: TreeVisualStyle): TreeBitmap {
  const key = makeTreeKey(style);
  let bitmap = treeBitmapCache.get(key);
  if (!bitmap) {
    bitmap = createTreeBitmap(style);
    treeBitmapCache.set(key, bitmap);
  }
  return bitmap;
}

function drawCachedTree(request: TreePlacement): void {
  const bitmap = getTreeBitmap(request.style);
  if (bitmap.width === 0 || bitmap.height === 0) return;

  const align = request.align ?? 'bottom';
  let drawX = request.x;
  let drawY = request.y;

  if (align === 'center') {
    drawX = Math.round(request.x - bitmap.width / 2);
    drawY = Math.round(request.y - bitmap.height / 2);
  } else if (align === 'bottom') {
    drawX = Math.round(request.x - bitmap.width / 2);
    drawY = Math.round(request.y - bitmap.height);
  } else {
    drawX = Math.round(request.x);
    drawY = Math.round(request.y);
  }

  ctx.drawImage(bitmap.canvas, drawX, drawY);
}

export function drawBackgroundGrid(cameraY: number, timestamp: number): void {
  const groundLineY = groundY - cameraY;

  foregroundTrees.forEach((placement) => {
    drawCachedTree({
      ...placement,
      y: groundLineY,
    });
  });

  drawCachedTree({
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
