import { CANVAS_MAX_WIDTH } from '../../config/constants.js';
import { resetBubbleField } from '../environment/bubble_field.js';
import { resetWellDepth } from '../environment/well_layout.js';
import { resetCliffs } from '../environment/drawables/drawCliffs.js';

const canvasElement = document.getElementById('gameCanvas');
if (!(canvasElement instanceof HTMLCanvasElement)) {
  throw new Error('Unable to locate #gameCanvas canvas element.');
}

export const canvas: HTMLCanvasElement = canvasElement;
const context = canvas.getContext('2d', { alpha: true });
if (!(context instanceof CanvasRenderingContext2D)) {
  throw new Error('Unable to acquire 2D canvas context.');
}

export const ctx: CanvasRenderingContext2D = context;

export let canvasWidth = 0;
export let canvasHeight = 0;
export let groundY = 0;

export function updateCanvasSize(): void {
  const desiredWidth = Math.min(window.innerWidth, CANVAS_MAX_WIDTH);
  canvas.width = desiredWidth;
  canvas.style.width = `${desiredWidth}px`;
  canvas.height = window.innerHeight;
  canvasWidth = canvas.width;
  canvasHeight = canvas.height;
  groundY = canvasHeight - 116;
  resetWellDepth(canvasHeight);
  resetBubbleField();
  resetCliffs();
}

window.addEventListener('resize', updateCanvasSize);
updateCanvasSize();
