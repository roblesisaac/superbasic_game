import { drawGrass } from '../../gui/drawGrass.js';
import { drawTree } from '../../gui/drawTree.js';
import { drawWell } from '../../gui/drawWell.js';
import { ctx, canvasWidth, groundY } from '../state/rendering_state.js';

export function drawBackgroundGrid(cameraY: number): void {
  drawGrass(ctx, {
    width: canvasWidth,
    groundY,
    cameraY
  });

  drawTree(ctx, {
    x: canvasWidth * 0.22,
    groundY,
    cameraY,
    size: 82,
    foliageDensity: 0.78,
    bushiness: 1.25,
    seed: 0x22b
  });

  drawWell(ctx, {
    x: canvasWidth * 0.7,
    groundY,
    cameraY,
    scale: 0.85
  });
}
