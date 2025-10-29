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
  const desiredWidth = Math.min(window.innerWidth, CANVAS_MAX_WIDTH);

  // Set canvas size (no DPR scaling - we handle crisp rendering via imageSmoothingEnabled)
  canvas.width = desiredWidth;
  canvas.height = window.innerHeight;

  // Set canvas display size (same as internal size)
  canvas.style.width = `${desiredWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;

  // Disable image smoothing for crisp pixel art
  ctx.imageSmoothingEnabled = false;

  // Use canvas dimensions for game logic
  canvasWidth = desiredWidth;
  canvasHeight = window.innerHeight;
  groundY = canvasHeight - 116;
  resetWellDepth(canvasHeight);
  resetBubbleField();
  resetCliffs();
}

window.addEventListener("resize", updateCanvasSize);
updateCanvasSize();
