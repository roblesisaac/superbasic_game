import { drawGrass } from '../../gui/drawGrass.js';
import { drawTree } from '../../gui/drawTree.js';
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

  drawTree(ctx, { tree: 'tree2', x: 100, y: groundY - cameraY, pixelSize: 1.2, align: 'bottom' });

  drawTree(ctx, { tree: 'tree2', x: 300, y: groundY - cameraY, pixelSize: 1.5, align: 'bottom' });

  drawGrass(ctx, {
    width: canvasWidth,
    groundY,
    cameraY
  });
}
