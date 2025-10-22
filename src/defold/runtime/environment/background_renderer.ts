import { drawGrass } from '../../gui/drawGrass.js';
import { drawTree } from '../../gui/drawTree.js';
import { drawWell } from '../../gui/drawWell.js';
import { ctx, canvasHeight, canvasWidth, groundY } from '../state/rendering_state.js';
import { drawBubbleField, updateBubbleField, type BubbleEnvironment } from './bubble_field.js';
import { getWellBounds } from './well_layout.js';

export function drawBackgroundGrid(cameraY: number, timestamp: number): void {
  drawGrass(ctx, {
    width: canvasWidth,
    groundY,
    cameraY
  });

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

  drawTree(ctx, {
    x: canvasWidth * 0.23,
    groundY,
    cameraY,
    size: 80,
    foliageDensity: 0.78,
    bushiness: 0.90
  });

  drawTree(ctx, {
    x: canvasWidth * 0.60,
    groundY,
    cameraY,
    size: 80,
    foliageDensity: 0.78,
    bushiness: 0.90
  });

  drawTree(ctx, {
    x: canvasWidth * 0.70,
    groundY,
    cameraY,
    size: 80,
    foliageDensity: 0.78,
    bushiness: 0.90
  });
}
