import { getWellCameraBounds } from '../../game_objects/well.js';

export let cameraY = 0;
export let maxHeight = 0;

export function setCameraY(value: number): void {
  cameraY = value;
}

export function clampCameraToGround(): void {
  const { maxDownward } = getWellCameraBounds();
  const limit = Number.isFinite(maxDownward) ? maxDownward : 0;
  cameraY = Math.min(cameraY, limit);
}

export function registerHeight(y: number): void {
  maxHeight = Math.max(maxHeight, y);
}

export function resetCamera(): void {
  cameraY = 0;
  maxHeight = 0;
}
