import {
  getWellBounds,
  getWellExpansionTopY,
  getWellRimTopY,
  getWellShaftSpan,
  getWellShaftBottomY,
  WELL_COLLAR_HEIGHT,
  WELL_RIM_THICKNESS,
} from "./well_layout.js";
import { CLIFF_CELL_SIZE } from "./drawables/drawCliffs.js";
import { getCliffStateForCollision } from "./drawables/drawWell.js";
import { getCliffInteriorBoundsAtY } from "../../assets/bitmaps/drawCliffs2.js";

export interface WellCollisionRect {
  x: number;
  y: number;
  w: number;
  h: number;
  side?: "left" | "right";
}

interface WellCollisionParams {
  rangeTop: number;
  rangeBottom: number;
  canvasWidth: number;
  canvasHeight: number;
  groundY: number;
}

const WALL_THICKNESS = CLIFF_CELL_SIZE;
const ARM_HEIGHT = CLIFF_CELL_SIZE * 2;

function clipRect(
  rects: WellCollisionRect[],
  rect: WellCollisionRect,
  rangeTop: number,
  rangeBottom: number,
): void {
  if (!Number.isFinite(rect.x) || !Number.isFinite(rect.y)) return;
  if (!Number.isFinite(rect.w) || !Number.isFinite(rect.h)) return;
  if (rect.w <= 0 || rect.h <= 0) return;

  const rectTop = rect.y;
  const rectBottom = rect.y + rect.h;
  if (rectBottom < rangeTop || rectTop > rangeBottom) return;

  const clippedTop = Math.max(rectTop, rangeTop);
  const clippedBottom = Math.min(rectBottom, rangeBottom);
  const clippedHeight = clippedBottom - clippedTop;
  if (clippedHeight <= 0) return;

  rects.push({
    x: rect.x,
    y: clippedTop,
    w: rect.w,
    h: clippedHeight,
    side: rect.side,
  });
}

export function getWellCollisionRects(
  params: WellCollisionParams,
): WellCollisionRect[] {
  const { rangeTop, rangeBottom, canvasWidth, canvasHeight, groundY } = params;
  const rects: WellCollisionRect[] = [];

  if (!Number.isFinite(rangeTop) || !Number.isFinite(rangeBottom)) return rects;
  if (!Number.isFinite(canvasWidth) || !Number.isFinite(canvasHeight))
    return rects;

  const bounds = getWellBounds(canvasWidth);
  const shaftSpan = getWellShaftSpan(bounds);
  const expansionTop = getWellExpansionTopY(groundY, canvasHeight);
  const shaftBottom = getWellShaftBottomY(groundY, canvasHeight);

  // Narrow shaft walls run from just below the rim to the cavern expansion.
  const rimTop = getWellRimTopY(groundY);
  const shaftTop = Math.min(
    groundY - WELL_COLLAR_HEIGHT,
    rimTop + WELL_RIM_THICKNESS + CLIFF_CELL_SIZE,
  );
  const shaftWallBottom = Math.min(expansionTop, shaftBottom);

  if (shaftWallBottom > shaftTop) {
    const leftWallRight = shaftSpan.interiorLeft;
    const rightWallLeft = shaftSpan.interiorRight;

    clipRect(
      rects,
      {
        x: leftWallRight - WALL_THICKNESS,
        y: shaftTop,
        w: WALL_THICKNESS,
        h: shaftWallBottom - shaftTop,
        side: "left",
      },
      rangeTop,
      rangeBottom,
    );

    clipRect(
      rects,
      {
        x: rightWallLeft,
        y: shaftTop,
        w: WALL_THICKNESS,
        h: shaftWallBottom - shaftTop,
        side: "right",
      },
      rangeTop,
      rangeBottom,
    );
  }

  // Horizontal L arms that flare into the cavern space.
  const armTop = Math.max(rangeTop, expansionTop - ARM_HEIGHT);
  const armBottom = Math.min(expansionTop, rangeBottom);
  if (armBottom > armTop) {
    const armHeight = Math.min(ARM_HEIGHT, armBottom - armTop);

    const leftArmWidth = Math.max(0, shaftSpan.interiorLeft);
    if (leftArmWidth > 0) {
      clipRect(
        rects,
        {
          x: 0,
          y: armBottom - armHeight,
          w: leftArmWidth,
          h: armHeight,
        },
        rangeTop,
        rangeBottom,
      );
    }

    const rightArmStart = Math.max(shaftSpan.interiorRight, 0);
    if (rightArmStart < canvasWidth) {
      clipRect(
        rects,
        {
          x: rightArmStart,
          y: armBottom - armHeight,
          w: canvasWidth - rightArmStart,
          h: armHeight,
        },
        rangeTop,
        rangeBottom,
      );
    }
  }

  // Add cliff collision rectangles for the cavern area
  const cliffData = getCliffStateForCollision();
  if (cliffData) {
    const { state, cavernTop, canvasWidth: cliffCanvasWidth } = cliffData;
    
    // Sample cliff edges at regular intervals within the range
    const sampleInterval = CLIFF_CELL_SIZE * 2;
    const startY = Math.max(rangeTop, expansionTop);
    const endY = Math.min(rangeBottom, shaftBottom);
    
    for (let y = startY; y < endY; y += sampleInterval) {
      const worldY = y - cavernTop; // Convert to cliff-local coordinates
      const bounds = getCliffInteriorBoundsAtY(state, worldY, cliffCanvasWidth);
      
      // Create collision rects for left cliff (from 0 to left boundary)
      if (bounds.left > 0) {
        clipRect(
          rects,
          {
            x: 0,
            y: y,
            w: bounds.left,
            h: sampleInterval,
            side: "left",
          },
          rangeTop,
          rangeBottom,
        );
      }
      
      // Create collision rects for right cliff (from right boundary to canvas width)
      if (bounds.right < canvasWidth) {
        clipRect(
          rects,
          {
            x: bounds.right,
            y: y,
            w: canvasWidth - bounds.right,
            h: sampleInterval,
            side: "right",
          },
          rangeTop,
          rangeBottom,
        );
      }
    }
  }

  return rects;
}
