import { drawGrass } from '../../gui/drawGrass.js';
import { drawTree } from '../../gui/drawTree.js';
import { ctx, canvasWidth, groundY } from '../state/rendering_state.js';
import { getSurfaceWellRect } from './well_experience.js';

function drawWellEntrance(cameraY: number): void {
  const rect = getSurfaceWellRect(canvasWidth, groundY);
  const topY = Math.round(groundY - cameraY);
  const rimHeight = 6;
  const shaftDepth = 48;

  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(rect.x, topY - rimHeight, rect.width, rimHeight);

  const innerX = rect.x + 2;
  const innerWidth = rect.width - 4;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(innerX, topY, innerWidth, shaftDepth);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x, topY - rimHeight, rect.width, rimHeight);

  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(rect.x, topY);
  ctx.lineTo(rect.x, topY + shaftDepth);
  ctx.moveTo(rect.x + rect.width, topY);
  ctx.lineTo(rect.x + rect.width, topY + shaftDepth);
  ctx.stroke();
  ctx.restore();
}

export function drawBackgroundGrid(cameraY: number): void {
  drawGrass(ctx, {
    width: canvasWidth,
    groundY,
    cameraY
  });

  drawTree(ctx, {
    x: canvasWidth * 0.22,
    groundY,
    cameraY,
    size: 82,
    foliageDensity: 0.78,
    bushiness: 1.25,
    seed: 0x22b
  });
  drawWellEntrance(cameraY);
}
