import { SPRITE_SIZE } from '../../../config/constants.js';

// Keep the well roughly beneath the floating heart pickup which sits ~32px from the right edge.
const WELL_CENTER_RIGHT_OFFSET = 32;
const EDGE_MARGIN = 4;

export const WELL_OPENING_WIDTH = SPRITE_SIZE * 2;
export const WELL_RIM_THICKNESS = 4;
export const WELL_COLLAR_HEIGHT = 8;
export const WELL_SHAFT_COLUMN_INSET = 2;
export const WELL_SHAFT_COLUMN_WIDTH = 4;
export const WELL_NARROW_SHAFT_DEPTH_MULTIPLIER = 3;
export const WELL_CAVERN_DEPTH_MULTIPLIER = 1;
export const WELL_RIM_TOP_OFFSET = WELL_RIM_THICKNESS * 2 + 1;

export interface WellBounds {
  left: number;
  right: number;
  centerX: number;
  openingWidth: number;
  rimLeft: number;
  rimRight: number;
  rimOuterWidth: number;
}

export function getWellBounds(canvasWidth: number): WellBounds {
  const openingWidth = Math.round(WELL_OPENING_WIDTH);
  const rimOuterWidth = openingWidth + WELL_RIM_THICKNESS * 2;
  const desiredCenter = Math.round(canvasWidth - WELL_CENTER_RIGHT_OFFSET);
  const rimHalfWidth = Math.round(rimOuterWidth / 2);
  const rimMinLeft = EDGE_MARGIN;
  const rimMaxRight = Math.max(canvasWidth - EDGE_MARGIN, EDGE_MARGIN + rimOuterWidth);
  const rimMaxLeft = Math.max(rimMinLeft, rimMaxRight - rimOuterWidth);

  let rimLeft = desiredCenter - rimHalfWidth;
  if (rimLeft < rimMinLeft) {
    rimLeft = rimMinLeft;
  } else if (rimLeft > rimMaxLeft) {
    rimLeft = rimMaxLeft;
  }

  const rimRight = rimLeft + rimOuterWidth;
  const left = rimLeft + WELL_RIM_THICKNESS;
  const right = left + openingWidth;
  const centerX = rimLeft + rimHalfWidth;

  return {
    left,
    right,
    centerX,
    openingWidth,
    rimLeft,
    rimRight,
    rimOuterWidth
  };
}

export function getWellRimTopY(groundY: number): number {
  return groundY - WELL_RIM_TOP_OFFSET;
}

export interface WellShaftSpan {
  interiorLeft: number;
  interiorRight: number;
}

export function getWellShaftSpan(bounds: WellBounds): WellShaftSpan {
  const interiorLeft = bounds.left + WELL_SHAFT_COLUMN_INSET + WELL_SHAFT_COLUMN_WIDTH;
  const interiorRight = bounds.right - WELL_SHAFT_COLUMN_INSET - WELL_SHAFT_COLUMN_WIDTH;

  if (interiorLeft > interiorRight) {
    const center = (bounds.left + bounds.right) / 2;
    return { interiorLeft: center, interiorRight: center };
  }

  return { interiorLeft, interiorRight };
}

export function getWellNarrowShaftDepth(canvasHeight: number): number {
  return Math.max(0, Math.round(canvasHeight * WELL_NARROW_SHAFT_DEPTH_MULTIPLIER));
}

export function getWellCavernDepth(canvasHeight: number): number {
  return Math.max(0, Math.round(canvasHeight * WELL_CAVERN_DEPTH_MULTIPLIER));
}

export function getWellShaftDepth(canvasHeight: number): number {
  return getWellNarrowShaftDepth(canvasHeight) + getWellCavernDepth(canvasHeight);
}

export function getWellShaftBottomY(groundY: number, canvasHeight: number): number {
  return groundY + getWellShaftDepth(canvasHeight);
}

export function getWellExpansionSpan(canvasWidth: number): WellShaftSpan {
  return { interiorLeft: 0, interiorRight: Math.max(canvasWidth, 0) };
}

export function getWellExpansionTopY(groundY: number, canvasHeight: number): number {
  return groundY + getWellNarrowShaftDepth(canvasHeight);
}

export function getWellExpansionBottomY(groundY: number, canvasHeight: number): number {
  return getWellExpansionTopY(groundY, canvasHeight) + getWellCavernDepth(canvasHeight);
}
