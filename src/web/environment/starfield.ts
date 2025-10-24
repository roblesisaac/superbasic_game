import { groundY } from '../../defold/runtime/state/rendering_state.js';
import { cameraY } from '../../defold/runtime/state/camera_state.js';
import {
  createStarfieldState,
  updateStarfield,
  computeSceneDimensions,
  computeGroundLineY,
  generateMoonRenderData,
  DEFAULT_STARFIELD_CONFIG,
  DEFAULT_GROUND_OFFSET,
  type StarfieldState,
} from '../../defold/runtime/environment/starfield_model.js';

const STARFIELD_CANVAS_ID = 'starfieldCanvas';

const STAR_SIZE = 2;
const NUM_CLOUDS = 5;
const CLOUD_SIZE = 1;
const CLOUD_OPACITY = 0.25;
const CLOUD_SPEED = 1;
const CLOUD_DETAIL = 4;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let starfieldState: StarfieldState | null = null;
let lastTime = 0;

function ensureCanvas(): void {
  if (canvas) return;

  const existing = document.getElementById(STARFIELD_CANVAS_ID) as HTMLCanvasElement | null;
  if (existing) {
    canvas = existing;
  } else {
    canvas = document.createElement('canvas');
    canvas.id = STARFIELD_CANVAS_ID;
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
  }

  ctx = canvas.getContext('2d', { alpha: false });

  if (ctx) {
    ctx.imageSmoothingEnabled = false;
  }
}

function resizeCanvas(): void {
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function getCanvasDimensions(): { width: number; height: number } {
  if (!canvas) {
    return {
      width: DEFAULT_STARFIELD_CONFIG.baseWidth,
      height: DEFAULT_STARFIELD_CONFIG.baseHeight,
    };
  }

  return {
    width: canvas.clientWidth || DEFAULT_STARFIELD_CONFIG.baseWidth,
    height: canvas.clientHeight || DEFAULT_STARFIELD_CONFIG.baseHeight,
  };
}

function initialiseState(): void {
  const dimensions = getCanvasDimensions();
  starfieldState = createStarfieldState(dimensions, {
    cloudCount: NUM_CLOUDS,
    cloudSize: CLOUD_SIZE,
    cloudSpeed: CLOUD_SPEED,
    cloudDetail: CLOUD_DETAIL,
  });
}

function update(dt: number): void {
  if (!starfieldState) return;
  const dimensions = getCanvasDimensions();
  updateStarfield(starfieldState, dimensions, dt);
}

function drawMoon(): void {
  if (!ctx) return;

  const scene = computeSceneDimensions(getCanvasDimensions());
  const moon = generateMoonRenderData(scene);

  ctx.fillStyle = '#fff';
  for (const cell of moon.body) {
    ctx.fillRect(cell.x, cell.y, cell.width, cell.height);
  }

  ctx.fillStyle = '#000';
  for (const cell of moon.shadow) {
    ctx.fillRect(cell.x, cell.y, cell.width, cell.height);
  }

  for (const cell of moon.craters) {
    ctx.fillRect(cell.x, cell.y, cell.width, cell.height);
  }

  for (const cell of moon.arc) {
    ctx.fillRect(cell.x, cell.y, cell.width, cell.height);
  }
}

function drawStars(): void {
  if (!ctx || !starfieldState) return;

  const smallSize = Math.max(1, Math.round(STAR_SIZE));
  const brightHalfLen = Math.max(1, Math.round(STAR_SIZE * 2));
  const brightThickness = Math.max(1, Math.round(STAR_SIZE * 0.6));

  for (const star of starfieldState.stars) {
    const alpha = star.currentAlpha ?? star.baseAlpha;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff';

    if (star.type === 'small') {
      ctx.fillRect(Math.floor(star.x), Math.floor(star.y), smallSize, smallSize);
    } else {
      const x = Math.floor(star.x);
      const y = Math.floor(star.y);
      const t = brightThickness;
      const L = brightHalfLen;

      ctx.fillRect(x - L, y - Math.floor(t / 2), 2 * L + t, t);
      ctx.fillRect(x - Math.floor(t / 2), y - L, t, 2 * L + t);
    }
  }

  ctx.globalAlpha = 1;
}

function noise2D(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

function fbm(x: number, y: number, seed: number, octaves: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, y * frequency, seed + i) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return maxValue > 0 ? value / maxValue : 0;
}

function drawClouds(): void {
  if (!ctx || !starfieldState) return;

  const { width, height } = getCanvasDimensions();
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height / 2.3;
  const tempCtx = tempCanvas.getContext('2d');

  if (!tempCtx) return;

  tempCtx.clearRect(0, 0, width, height);
  tempCtx.fillStyle = '#fff';

  for (const cloud of starfieldState.clouds) {
    const ps = cloud.pixelSize;
    const scale = 0.05;

    for (let px = 0; px < cloud.width; px += ps) {
      for (let py = 0; py < cloud.height; py += ps) {
        const worldX = cloud.x + px;
        const worldY = cloud.y + py;

        const nx = px / cloud.width - 0.5;
        const ny = py / cloud.height - 0.5;
        const distFromCenter = Math.sqrt(nx * nx * 4 + ny * ny * 4);
        const edgeFalloff = Math.max(0, 1 - distFromCenter);

        const noiseValue = fbm(px * scale, py * scale, cloud.seed, cloud.octaves);
        const cloudValue = noiseValue * edgeFalloff;
        const threshold = 0.3 + Math.sin(px * 0.1) * 0.05;

        if (cloudValue > threshold) {
          tempCtx.fillRect(Math.floor(worldX), Math.floor(worldY), ps, ps);
        }
      }
    }
  }

  ctx.globalAlpha = CLOUD_OPACITY;
  ctx.drawImage(tempCanvas, 0, 0);
  ctx.globalAlpha = 1;
}

function drawGroundMask(width: number, height: number): void {
  if (!ctx || !starfieldState) return;

  const lineY = computeGroundLineY(height, groundY, cameraY, DEFAULT_GROUND_OFFSET);
  if (lineY <= 0) return;
  if (lineY >= height) return;

  const maskHeight = height - lineY;
  if (maskHeight <= 0) return;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, Math.round(lineY), width, Math.ceil(maskHeight));
}

function draw(): void {
  if (!ctx || !canvas) return;

  const { width, height } = getCanvasDimensions();
  const belowGround = cameraY > 0;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  if (belowGround || !starfieldState) {
    return;
  }

  drawStars();
  drawMoon();
  drawClouds();
  drawGroundMask(width, height);
}

function animate(currentTime: number): void {
  if (!canvas) return;

  const dt = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  if (dt < 0.1) {
    update(dt);
    draw();
  }

  window.requestAnimationFrame(animate);
}

function handleResize(): void {
  resizeCanvas();
  initialiseState();
}

function setupStarfield(): void {
  ensureCanvas();
  resizeCanvas();
  initialiseState();
  lastTime = performance.now();
  window.requestAnimationFrame(animate);
  window.removeEventListener('resize', handleResize);
  window.addEventListener('resize', handleResize);
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupStarfield, { once: true });
  } else {
    setupStarfield();
  }
}
