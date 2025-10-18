import { CAM_TOP, CAM_BOTTOM, SPRITE_SIZE } from '../../../config/constants.js';
import { canvasHeight, groundY } from '../state/rendering_state.js';
import { cameraY, setCameraY, clampCameraToGround } from '../state/camera_state.js';
import type { Sprite } from '../../game_objects/sprite.js';

export function updateCameraForSprite(sprite: Sprite): void {
  const topLine = canvasHeight * CAM_TOP;
  const bottomLine = canvasHeight * CAM_BOTTOM;
  const screenY = sprite.y - cameraY;

  if (screenY < topLine) {
    setCameraY(sprite.y - topLine);
  } else if (screenY > bottomLine) {
    setCameraY(sprite.y - bottomLine);
  }

  const spriteBottom = sprite.y + SPRITE_SIZE / 2;
  const belowGround = spriteBottom > groundY + 1;
  clampCameraToGround(belowGround);
}

export function resetCameraController(): void {
  setCameraY(0);
  clampCameraToGround(false);
}
