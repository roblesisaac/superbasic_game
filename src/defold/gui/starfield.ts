const STARFIELD_CANVAS_ID = 'starfieldCanvas';

/**
 * Controls the size of *all* stars (small + bright), in CSS pixels.
 * Increase for bigger stars, decrease for smaller ones.
 * Example values: 1 (tiny), 2 (default), 3–4 (larger).
 */
const STAR_SIZE = 2;

interface Star {
  x: number;
  y: number;
  type: 'small' | 'bright';
  baseAlpha: number;
  twinkleSpeed: number;
  offset: number;
  currentAlpha?: number;
}

interface SceneConfig {
  numSmallStars: number;
  numBrightStars: number;
  baseWidth: number;
  baseHeight: number;
  baseMoonRadius: number;
}

const baseConfig: SceneConfig = {
  numSmallStars: 250,
  numBrightStars: 40,
  baseWidth: 1024,
  baseHeight: 768,
  baseMoonRadius: 60
};

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let stars: Star[] = [];
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
    return { width: baseConfig.baseWidth, height: baseConfig.baseHeight };
  }

  return {
    width: canvas.clientWidth || baseConfig.baseWidth,
    height: canvas.clientHeight || baseConfig.baseHeight
  };
}

function computeStarCounts(): { small: number; bright: number } {
  const { width, height } = getCanvasDimensions();
  const area = Math.max(width * height, 1);
  const baseArea = baseConfig.baseWidth * baseConfig.baseHeight;
  const ratio = area / baseArea;

  const small = Math.max(40, Math.round(baseConfig.numSmallStars * ratio));
  const bright = Math.max(8, Math.round(baseConfig.numBrightStars * ratio));

  return { small, bright };
}

function getSceneDimensions(): {
  width: number;
  height: number;
  moonX: number;
  moonY: number;
  moonRadius: number;
  pixelSize: number;
} {
  const { width, height } = getCanvasDimensions();
  const moonRadius = (Math.min(width, height) / baseConfig.baseHeight) * baseConfig.baseMoonRadius;
  const scaledRadius = Math.max(20, moonRadius);
  const pixelSize = Math.max(3, Math.round(scaledRadius / 20));

  return {
    width,
    height,
    moonX: width * 0.65,
    moonY: height * 0.22,
    moonRadius: scaledRadius,
    pixelSize
  };
}

function initStars(): void {
  stars = [];
  const { small, bright } = computeStarCounts();
  const { width, height } = getCanvasDimensions();

  for (let i = 0; i < small; i += 1) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      type: 'small',
      baseAlpha: 0 + Math.random() * 0.5,
      twinkleSpeed: 1 + Math.random() * 2,
      offset: Math.random() * Math.PI * 2
    });
  }

  for (let i = 0; i < bright; i += 1) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      type: 'bright',
      baseAlpha: 0.7 + Math.random() * 0.3,
      twinkleSpeed: 0.5 + Math.random() * 1,
      offset: Math.random() * Math.PI * 2
    });
  }
}

function update(dt: number): void {
  for (const star of stars) {
    star.offset += dt * star.twinkleSpeed;
    const alpha = star.baseAlpha + Math.sin(star.offset) * 0.5;
    star.currentAlpha = Math.max(0.2, Math.min(1, alpha));
  }
}

function drawPixelatedCrater(
  cx: number,
  cy: number,
  radius: number,
  pixelSize: number,
  dithered: boolean
): void {
  if (!ctx) return;

  ctx.fillStyle = '#000';

  for (let px = cx - radius; px <= cx + radius; px += pixelSize) {
    for (let py = cy - radius; py <= cy + radius; py += pixelSize) {
      const dx = px - cx;
      const dy = py - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius) {
        if (!dithered || (Math.floor(px / pixelSize) + Math.floor(py / pixelSize)) % 2 === 0) {
          ctx.fillRect(px, py, pixelSize, pixelSize);
        }
      }
    }
  }
}

function drawPixelatedArc(cx: number, cy: number, radius: number, pixelSize: number): void {
  if (!ctx) return;

  ctx.fillStyle = '#000';

  for (let angle = 0; angle < Math.PI; angle += 0.2) {
    const px = Math.floor(cx + Math.cos(angle) * radius);
    const py = Math.floor(cy + Math.sin(angle) * radius);
    ctx.fillRect(px, py, pixelSize, pixelSize);
  }
}

function drawMoon(): void {
  if (!ctx) return;

  const { moonX, moonY, moonRadius, pixelSize } = getSceneDimensions();
  const x = Math.floor(moonX);
  const y = Math.floor(moonY);
  const r = moonRadius;

  ctx.fillStyle = '#fff';

  for (let px = x - r; px <= x + r; px += pixelSize) {
    for (let py = y - r; py <= y + r; py += pixelSize) {
      const dx = px - x;
      const dy = py - y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= r) {
        ctx.fillRect(px, py, pixelSize, pixelSize);
      }
    }
  }

  ctx.fillStyle = '#000';
  const shadowOffsetX = r * 0.42;
  const shadowOffsetY = -r * 0.08;

  for (let px = x - r; px <= x + r; px += pixelSize) {
    for (let py = y - r; py <= y + r; py += pixelSize) {
      const dx = px - (x + shadowOffsetX);
      const dy = py - (y + shadowOffsetY);
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= r) {
        ctx.fillRect(px, py, pixelSize, pixelSize);
      }
    }
  }

  const craterRadius = r * 0.3;
  drawPixelatedCrater(x - r * 0.3, y - r * 0.1, craterRadius, pixelSize, true);
  drawPixelatedCrater(x + r * 0.15, y + r * 0.2, craterRadius * 0.7, pixelSize, false);
  drawPixelatedArc(x + r * 0.25, y - r * 0.35, craterRadius * 0.8, pixelSize);
}

function drawStars(): void {
  if (!ctx) return;

  // ---- Star sizing derived from STAR_SIZE ----
  const smallSize = Math.max(1, Math.round(STAR_SIZE));                 // square star size
  const brightHalfLen = Math.max(1, Math.round(STAR_SIZE * 2));         // half-length of bright star arms
  const brightThickness = Math.max(1, Math.round(STAR_SIZE * 0.6));     // thickness of arms
  // -------------------------------------------

  for (const star of stars) {
    const alpha = star.currentAlpha ?? star.baseAlpha;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';

    if (star.type === 'small') {
      // Draw a small square star
      ctx.fillRect(
        Math.floor(star.x),
        Math.floor(star.y),
        smallSize,
        smallSize
      );
    } else {
      // Draw a bright "cross" star with arms scaled by STAR_SIZE
      const x = Math.floor(star.x);
      const y = Math.floor(star.y);

      const t = brightThickness;
      const L = brightHalfLen;

      // Horizontal arm
      ctx.fillRect(x - L, y - Math.floor(t / 2), 2 * L + t, t);
      // Vertical arm
      ctx.fillRect(x - Math.floor(t / 2), y - L, t, 2 * L + t);
    }
  }

  ctx.globalAlpha = 1;
}

function draw(): void {
  if (!ctx || !canvas) return;

  const { width, height } = getCanvasDimensions();

  // Clear background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // Draw stars FIRST (bottom layer)
  drawStars();

  // Draw moon LAST (top layer) - this ensures moon covers any stars
  drawMoon();
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
  initStars();
}

function setupStarfield(): void {
  ensureCanvas();
  resizeCanvas();
  initStars();
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