import { GRID_SIZE, CANVAS_MAX_WIDTH } from '../config/constants.js';

type Sprite = import('../entities/sprite.js').Sprite;
type Ride = import('../entities/rides.js').Ride;
type Gate = import('../entities/gates.js').Gate | import('../entities/controlledGate.js').ControlledGate;
type InputHandler = import('./input.js').InputHandler;
type EnergyBar = import('../ui/hud.js').EnergyBar;
type Hearts = import('../ui/hud.js').Hearts;

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

const gameOverElement = document.getElementById('gameOver');
const gameOverPanelElement = document.getElementById('gameOverPanel');

if (!(gameOverElement instanceof HTMLDivElement)) {
  throw new Error('Unable to locate game over container element.');
}
if (!(gameOverPanelElement instanceof HTMLDivElement)) {
  throw new Error('Unable to locate game over panel element.');
}

export const gameOverDiv: HTMLDivElement = gameOverElement;
export const gameOverPanel: HTMLDivElement = gameOverPanelElement;

export let canvasWidth = 0;
export let canvasHeight = 0;
export let groundY = 0;
export let cameraY = 0;
export let cameraX = 0;
export let worldWidth = 0;
export let maxHeight = 0;

export function setCameraY(v: number) { cameraY = v; }
export function setCameraX(v: number) {
  const maxCameraX = Math.max(0, worldWidth - canvasWidth);
  cameraX = Math.max(0, Math.min(v, maxCameraX));
}
export function addMaxHeight(v: number) { maxHeight = Math.max(maxHeight, v); }

export function setWorldWidth(v: number) {
  const width = Math.max(canvasWidth, Math.max(0, v));
  worldWidth = width;
  setCameraX(cameraX);
}

export function resize() {
  const desiredWidth = Math.min(window.innerWidth, CANVAS_MAX_WIDTH);
  canvas.width = desiredWidth;
  canvas.style.width = `${desiredWidth}px`;
  canvas.height = window.innerHeight;
  canvasWidth = canvas.width;
  canvasHeight = canvas.height;
  groundY = canvasHeight - 116;
  if (worldWidth < canvasWidth) {
    worldWidth = canvasWidth;
  }
  setCameraX(cameraX);
}
window.addEventListener('resize', resize);
resize();

export interface GameState {
  sprite: Sprite | null;
  rides: Ride[];
  gates: Gate[];
  input: InputHandler | null;
  energyBar: EnergyBar | null;
  hearts: Hearts | null;
  lastTime: number;
  running: boolean;
}

// Shared game singleton state
export const game: GameState = {
  sprite: null,
  rides: [],
  gates: [],
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
  const worldLeft = cameraX;
  const worldRight = cameraX + canvasWidth;

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
  let firstX = Math.floor(worldLeft / GRID_SIZE) * GRID_SIZE;
  if (firstX > worldLeft) firstX -= GRID_SIZE;

  for (let x = firstX; x <= worldRight; x += GRID_SIZE) {
    const sx = x - cameraX;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, canvasHeight);
    ctx.stroke();
  }

  ctx.restore();
}
