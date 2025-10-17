import { SPRITE_SIZE } from '../../../config/constants.js';

// Keep the well roughly beneath the floating heart pickup which sits ~32px from the right edge.
const WELL_CENTER_RIGHT_OFFSET = 32;
const DEFAULT_OPENING_WIDTH = SPRITE_SIZE * 2;
const EDGE_MARGIN = 4;

export interface WellBounds {
  left: number;
  right: number;
  centerX: number;
  openingWidth: number;
}

export function getWellBounds(canvasWidth: number): WellBounds {
  const openingWidth = Math.round(DEFAULT_OPENING_WIDTH);
  const desiredCenter = Math.round(canvasWidth - WELL_CENTER_RIGHT_OFFSET);
  const halfWidth = Math.round(openingWidth / 2);
  const minLeft = EDGE_MARGIN;
  const maxRight = Math.max(canvasWidth - EDGE_MARGIN, EDGE_MARGIN + openingWidth);
  const maxLeft = Math.max(minLeft, maxRight - openingWidth);

  let left = desiredCenter - halfWidth;
  if (left < minLeft) {
    left = minLeft;
  } else if (left > maxLeft) {
    left = maxLeft;
  }

  const right = left + openingWidth;

  const centerX = left + halfWidth;

  return {
    left,
    right,
    centerX,
    openingWidth
  };
}
