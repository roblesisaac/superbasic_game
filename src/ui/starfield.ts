const STARFIELD_CANVAS_ID = 'starfieldCanvas';

interface Star {
  x: number;
  y: number;
  type: 'small' | 'bright';
  baseAlpha: number;
  twinkleSpeed: number;
  offset: number;
  currentAlpha?: number;
}

const baseConfig = {
  numSmallStars: 100,
  numBrightStars: 20,
  baseWidth: 1024,
  baseHeight: 768
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

function initStars(): void {
  stars = [];
  const { small, bright } = computeStarCounts();
  const { width, height } = getCanvasDimensions();

  for (let i = 0; i < small; i += 1) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      type: 'small',
      baseAlpha: 0.5 + Math.random() * 0.5,
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
      twinkleSpeed: 0.5 + Math.random(),
      offset: Math.random() * Math.PI * 2
    });
  }
}

function update(dt: number): void {
  for (const star of stars) {
    star.offset += dt * star.twinkleSpeed;
    const alpha = star.baseAlpha + Math.sin(star.offset) * 0.3;
    star.currentAlpha = Math.max(0.3, Math.min(1, alpha));
  }
}

function draw(): void {
  if (!ctx || !canvas) return;

  const { width, height } = getCanvasDimensions();

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  for (const star of stars) {
    const alpha = star.currentAlpha ?? star.baseAlpha;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';

    if (star.type === 'small') {
      ctx.fillRect(Math.floor(star.x), Math.floor(star.y), 2, 2);
    } else {
      const x = Math.floor(star.x);
      const y = Math.floor(star.y);
      ctx.fillRect(x - 2, y, 5, 1);
      ctx.fillRect(x, y - 2, 1, 5);
    }
  }

  ctx.globalAlpha = 1;
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
