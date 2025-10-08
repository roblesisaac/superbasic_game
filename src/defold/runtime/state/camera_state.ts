export let cameraY = 0;
export let maxHeight = 0;

export function setCameraY(value: number): void {
  cameraY = value;
}

export function clampCameraToGround(): void {
  cameraY = Math.min(cameraY, 0);
}

export function registerHeight(y: number): void {
  maxHeight = Math.max(maxHeight, y);
}

export function resetCamera(): void {
  cameraY = 0;
  maxHeight = 0;
}
