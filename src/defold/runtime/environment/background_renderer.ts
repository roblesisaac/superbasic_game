import { SPRITE_SIZE } from '../../../config/constants.js';
import { drawGrass } from '../../gui/drawGrass.js';
import { drawTree } from '../../gui/drawTree.js';
import { drawWell } from '../../gui/drawWell.js';
import { ctx, canvasWidth, canvasHeight, groundY } from '../state/rendering_state.js';

const WELL_CENTER_RATIO = 0.55;
const WELL_OPENING_WIDTH = SPRITE_SIZE * 2;

export function getWellBounds(width: number): { left: number; right: number; centerX: number } {
  const centerX = Math.round(width * WELL_CENTER_RATIO);
  const halfWidth = Math.round(WELL_OPENING_WIDTH / 2);
  const left = centerX - halfWidth;
  const right = left + WELL_OPENING_WIDTH;

  return { left, right, centerX };
}

export function drawBackgroundGrid(cameraY: number): void {
  drawGrass(ctx, {
    width: canvasWidth,
    groundY,
    cameraY
  });

  const { centerX, left, right } = getWellBounds(canvasWidth);
  const openingWidth = right - left;

  drawWell(ctx, {
    centerX,
    groundY,
    cameraY,
    canvasHeight,
    openingWidth
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
}
