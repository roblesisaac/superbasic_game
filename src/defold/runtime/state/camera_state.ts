import { CAM_BOTTOM } from '../../../config/constants.js';
import { getWellGeometry } from '../environment/well.js';
import { canvasHeight } from './rendering_state.js';

export let cameraY = 0;
export let maxHeight = 0;

export function setCameraY(value: number): void {
  cameraY = value;
}

export function clampCameraToGround(spriteY?: number): void {
  const well = getWellGeometry();
  let maxDownwardScroll = 0;

  if (
    spriteY !== undefined &&
    well.enabled &&
    spriteY > well.groundY
  ) {
    const bottomLine = canvasHeight * CAM_BOTTOM;
    const allowed = well.bottomY - bottomLine;
    maxDownwardScroll = Math.max(0, allowed);
  }

  cameraY = Math.min(cameraY, maxDownwardScroll);
}

export function registerHeight(y: number): void {
  maxHeight = Math.max(maxHeight, y);
}

export function resetCamera(): void {
  cameraY = 0;
  maxHeight = 0;
}
