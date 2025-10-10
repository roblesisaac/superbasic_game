import { drawGrass } from '../../gui/drawGrass.js';
import { ctx, canvasWidth, groundY } from '../state/rendering_state.js';

export function drawBackgroundGrid(cameraY: number): void {
  drawGrass(ctx, {
    width: canvasWidth,
    groundY,
    cameraY
  });
}
