import { canvasHeight, groundY } from "./rendering_state.js";
import {
  ensureWellDepth,
  getWellShaftBottomY,
} from "../environment/well_layout.js";

export let cameraY = 0;
export let maxHeight = 0;

export function setCameraY(value: number): void {
  cameraY = value;
}

export function clampCameraToGround(belowGround = false): void {
  if (belowGround) {
    ensureWellDepth(groundY, canvasHeight, cameraY + canvasHeight * 2);
    const bottomLimit = Math.max(
      0,
      getWellShaftBottomY(groundY, canvasHeight) - canvasHeight,
    );
    cameraY = Math.min(cameraY, bottomLimit);
  } else {
    cameraY = Math.min(cameraY, 0);
  }
}

export function registerHeight(y: number): void {
  maxHeight = Math.max(maxHeight, y);
}

export function resetCamera(): void {
  cameraY = 0;
  maxHeight = 0;
}
