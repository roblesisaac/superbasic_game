import type { Sprite } from '../game_objects/sprite.js';
import { getWellState } from '../game_objects/well.js';

type DrawWellOptions = {
  ctx: CanvasRenderingContext2D;
  cameraY: number;
  sprite: Sprite | null;
  timeMs: number;
};

function drawPixelatedBubble(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  drawTrail: boolean
): void {
  const pixelSize = 2;
  const diameter = radius * 2;
  const gridSize = Math.ceil(diameter / pixelSize);

  ctx.fillStyle = '#ffffff';

  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      const x = cx - radius + col * pixelSize;
      const y = cy - radius + row * pixelSize;
      const dx = x + pixelSize / 2 - cx;
      const dy = y + pixelSize / 2 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= radius - pixelSize * 1.4 && dist <= radius + pixelSize * 0.6) {
        ctx.fillRect(Math.round(x), Math.round(y), pixelSize, pixelSize);
      }
    }
  }

  if (!drawTrail) return;

  const numTrail = Math.min(5, Math.max(1, Math.floor(radius / 10)));
  const startOffset = 10;

  for (let i = 0; i < numTrail; i += 1) {
    const progress = i / numTrail;
    const trailY = cy + radius + startOffset + i * 10;
    const trailRadius = Math.max(2, radius * 0.2 * (1 - progress * 0.6));
    const trailPixelSize = 2;
    const trailGrid = Math.ceil((trailRadius * 2) / trailPixelSize);
    const wobble = Math.sin(i * 2.6) * Math.max(1, radius * 0.08);

    for (let row = 0; row < trailGrid; row += 1) {
      for (let col = 0; col < trailGrid; col += 1) {
        const x = cx + wobble - trailRadius + col * trailPixelSize;
        const y = trailY - trailRadius + row * trailPixelSize;
        const dx = x + trailPixelSize / 2 - (cx + wobble);
        const dy = y + trailPixelSize / 2 - trailY;
        if (Math.sqrt(dx * dx + dy * dy) <= trailRadius) {
          ctx.fillRect(Math.round(x), Math.round(y), trailPixelSize, trailPixelSize);
        }
      }
    }
  }
}

function drawWellStructure(ctx: CanvasRenderingContext2D, cameraY: number, dashToggle: number): void {
  const { geometry } = getWellState();
  const topY = geometry.topY - cameraY;
  const narrowBottomY = geometry.narrowBottomY - cameraY;
  const bottomY = geometry.bottomY - cameraY;
  const waterSurface = geometry.waterSurfaceY - cameraY;

  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = geometry.wallThickness;
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(geometry.topLeftX, topY);
  ctx.lineTo(geometry.topLeftX, narrowBottomY);
  ctx.lineTo(geometry.bottomLeftX, bottomY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(geometry.topRightX, topY);
  ctx.lineTo(geometry.topRightX, narrowBottomY);
  ctx.lineTo(geometry.bottomRightX, bottomY);
  ctx.stroke();

  ctx.lineWidth = 2;
  const dashLength = 12;
  const gapLength = 8;
  let currentX = geometry.bottomLeftX;
  let dashOn = dashToggle === 0;
  ctx.beginPath();
  while (currentX < geometry.bottomRightX) {
    if (dashOn) {
      ctx.moveTo(currentX, waterSurface);
      ctx.lineTo(currentX + dashLength, waterSurface);
      currentX += dashLength;
    } else {
      currentX += gapLength;
    }
    dashOn = !dashOn;
  }
  ctx.strokeStyle = '#5faaff';
  ctx.stroke();

  ctx.restore();
}

export function drawWell({ ctx, cameraY, sprite, timeMs: _timeMs }: DrawWellOptions): void {
  const state = getWellState();
  drawWellStructure(ctx, cameraY, state.dashToggle);

  for (const bubble of state.bubbles) {
    if (!bubble.active) continue;
    const screenY = bubble.y - cameraY;
    if (screenY < -160 || screenY > ctx.canvas.height + 160) continue;
    drawPixelatedBubble(ctx, Math.round(bubble.x), Math.round(screenY), bubble.radius, true);
  }

  if (sprite && state.occupant.inBubble) {
    const screenX = Math.round(sprite.x);
    const screenY = Math.round(sprite.y - cameraY);
    drawPixelatedBubble(ctx, screenX, screenY, state.occupant.bubbleRadius, false);
  }
}

