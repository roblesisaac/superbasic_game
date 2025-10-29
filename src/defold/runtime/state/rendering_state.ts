import { CANVAS_MAX_WIDTH } from "../../config/constants.js";
import { resetBubbleField } from "../environment/bubble_field.js";
import { resetWellDepth } from "../environment/well_layout.js";
import { resetCliffs } from "../environment/drawables/drawCliffs.js";

const canvasElement = document.getElementById("gameCanvas");
if (!(canvasElement instanceof HTMLCanvasElement)) {
  throw new Error("Unable to locate #gameCanvas canvas element.");
}

export const canvas: HTMLCanvasElement = canvasElement;
const context = canvas.getContext("2d", { alpha: true });
if (!(context instanceof CanvasRenderingContext2D)) {
  throw new Error("Unable to acquire 2D canvas context.");
}

export const ctx: CanvasRenderingContext2D = context;

export let canvasWidth = 0;
export let canvasHeight = 0;
export let groundY = 0;

export function updateCanvasSize(): void {
  const dpr = window.devicePixelRatio || 1;
  const desiredWidth = Math.min(window.innerWidth, CANVAS_MAX_WIDTH);
  
  // Set canvas internal resolution to match physical pixels
  canvas.width = desiredWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  
  // Set canvas display size (CSS pixels)
  canvas.style.width = `${desiredWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  
  // Disable image smoothing for crisp pixel art
  ctx.imageSmoothingEnabled = false;
  
  // Scale the context to match device pixel ratio
  ctx.scale(dpr, dpr);
  
  // Use CSS pixel dimensions for game logic
  canvasWidth = desiredWidth;
  canvasHeight = window.innerHeight;
  groundY = canvasHeight - 116;
  resetWellDepth(canvasHeight);
  resetBubbleField();
  resetCliffs();
}

window.addEventListener("resize", updateCanvasSize);
updateCanvasSize();
