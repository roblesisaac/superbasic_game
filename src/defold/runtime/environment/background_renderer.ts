import { drawGrass } from '../../gui/drawGrass.js';
import { drawTree, DrawTreeConfig } from '../../gui/drawTree.js';
import { drawWell } from '../../gui/drawWell.js';
import { ctx, canvasHeight, canvasWidth, groundY } from '../state/rendering_state.js';
import { drawBubbleField, updateBubbleField, type BubbleEnvironment } from './bubble_field.js';
import { getWellBounds } from './well_layout.js';

export function drawBackgroundGrid(cameraY: number, timestamp: number): void {
  const well = getWellBounds(canvasWidth);
  const bubbleEnv: BubbleEnvironment = {
    timestamp,
    cameraY,
    canvasHeight,
    canvasWidth,
    groundY,
    wellBounds: well
  };

  updateBubbleField(bubbleEnv);

  drawWell(ctx, {
    centerX: well.centerX,
    groundY,
    cameraY,
    canvasHeight,
    openingWidth: well.openingWidth
  });

  drawBubbleField(ctx, bubbleEnv);

  const treeConfig: any = {
    tree: 'tree2',
    y: groundY - cameraY,
    align: 'bottom'
  };

  drawTree(ctx, {
    ...treeConfig,
    x: 130,
    pixelSize: 1.5,
    heightScale: 1.5,
  });

  drawGrass(ctx, {
    width: canvasWidth,
    groundY,
    cameraY
  });
}
