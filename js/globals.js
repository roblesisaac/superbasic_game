import { GRID_SIZE, CANVAS_MAX_WIDTH } from './constants.js';

export const canvas = document.getElementById('gameCanvas');
export const ctx = canvas.getContext('2d', { alpha: true });

export const gameOverDiv = document.getElementById('gameOver');
export const gameOverPanel = document.getElementById('gameOverPanel');

export let canvasWidth = 0;
export let canvasHeight = 0;
export let groundY = 0;
export let cameraY = 0;
export let maxHeight = 0;

export function setCameraY(v) { cameraY = v; }
export function addMaxHeight(v) { maxHeight = Math.max(maxHeight, v); }

export function resize() {
  const desiredWidth = Math.min(window.innerWidth, CANVAS_MAX_WIDTH);
  canvas.width = desiredWidth;
  canvas.style.width = `${desiredWidth}px`;
  canvas.height = window.innerHeight;
  canvasWidth = canvas.width;
  canvasHeight = canvas.height;
  groundY = canvasHeight - 116;
}
window.addEventListener('resize', resize);
resize();

// Shared game singleton state
export const game = {
  sprite: null,
  platforms: [],
  input: null,
  energyBar: null,
  hearts: null,
  lastTime: 0,
  running: true
};

// Background grid drawing (used in main draw)
export function drawBackgroundGrid() {
  ctx.save();

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;

  const worldTop = cameraY;
  const worldBottom = cameraY + canvasHeight;

  let firstY = Math.floor(worldTop / GRID_SIZE) * GRID_SIZE;
  if (firstY > worldTop) firstY -= GRID_SIZE;

  for (let y = firstY; y <= worldBottom; y += GRID_SIZE) {
    const sy = y - cameraY;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(canvasWidth, sy);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  for (let x = 0; x <= canvasWidth; x += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
  }

  ctx.restore();
}
