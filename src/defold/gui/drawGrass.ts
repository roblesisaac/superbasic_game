interface GrassOptions {
  width: number;
  groundY: number;
  cameraY: number;
  density?: number;
  maxHeight?: number;
  variation?: number;
  tuftChance?: number;
  groundTextureChance?: number;
  seed?: number;
  color?: string;
}

function createRandom(sequenceSeed: number): () => number {
  let seed = sequenceSeed;
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

const DEFAULTS = {
  density: 0.32,
  maxHeight: 9,
  variation: 0.5,
  tuftChance: 0.28,
  groundTextureChance: 0.18,
  seed: 0x5a5a,
  color: '#fff'
} as const;

export function drawGrass(ctx: CanvasRenderingContext2D, options: GrassOptions): void {
  const {
    width,
    groundY,
    cameraY,
    density = DEFAULTS.density,
    maxHeight = DEFAULTS.maxHeight,
    variation = DEFAULTS.variation,
    tuftChance = DEFAULTS.tuftChance,
    groundTextureChance = DEFAULTS.groundTextureChance,
    seed = DEFAULTS.seed,
    color = DEFAULTS.color
  } = options;

  if (!Number.isFinite(width) || width <= 0) return;

  const screenGroundY = Math.round(groundY - cameraY);
  const canvasHeight = ctx.canvas?.height ?? 0;

  if (screenGroundY < -32 || screenGroundY > canvasHeight + 32) {
    return;
  }

  const random = createRandom(Math.floor(seed));

  ctx.fillStyle = color;
  ctx.fillRect(0, screenGroundY, width, 1);

  for (let x = 0; x < width; x += 1) {
    if (random() >= density) continue;

    const rawHeight = 2 + random() * maxHeight;
    const heightJitter = 1 + (random() - 0.5) * variation;
    const bladeHeight = Math.max(2, Math.floor(rawHeight * heightJitter));

    for (let y = 1; y <= bladeHeight; y += 1) {
      const wobble = Math.floor(Math.sin(y * 0.5 + random() * 3) * 1.5);
      const pixelX = x + wobble;
      if (pixelX < 0 || pixelX >= width) continue;

      const pixelY = screenGroundY - y;
      if (pixelY < 0 || pixelY >= canvasHeight) continue;
      if (y === bladeHeight && random() < 0.3) continue;

      ctx.fillRect(pixelX, pixelY, 1, 1);
    }

    if (random() < tuftChance) {
      const tuftHeight = Math.floor(random() * 3) + 1;
      const tuftDirection = random() > 0.5 ? 1 : -1;
      const tuftBaseX = x + tuftDirection;

      for (let ty = 1; ty <= tuftHeight; ty += 1) {
        const tuftY = screenGroundY - ty;
        if (tuftBaseX < 0 || tuftBaseX >= width) break;
        if (tuftY < 0 || tuftY >= canvasHeight) break;
        ctx.fillRect(tuftBaseX, tuftY, 1, 1);
      }
    }
  }

  for (let x = 0; x < width; x += 2) {
    if (random() >= groundTextureChance) continue;
    const dotY = screenGroundY - (Math.floor(random() * 2) + 1);
    if (dotY < 0 || dotY >= canvasHeight) continue;
    ctx.fillRect(x, dotY, 1, 1);
  }
}
