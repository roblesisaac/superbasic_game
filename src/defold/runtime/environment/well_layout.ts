import { SPRITE_SIZE } from '../../../config/constants.js';

const DEFAULT_WELL_OFFSET_RATIO = 0.55;
const DEFAULT_OPENING_WIDTH = SPRITE_SIZE * 2;

export interface WellBounds {
  left: number;
  right: number;
  centerX: number;
  openingWidth: number;
}

export function getWellBounds(canvasWidth: number): WellBounds {
  const openingWidth = Math.round(DEFAULT_OPENING_WIDTH);
  const centerX = Math.round(canvasWidth * DEFAULT_WELL_OFFSET_RATIO);
  const halfWidth = Math.round(openingWidth / 2);
  const left = centerX - halfWidth;
  const right = left + openingWidth;

  return {
    left,
    right,
    centerX,
    openingWidth
  };
}
