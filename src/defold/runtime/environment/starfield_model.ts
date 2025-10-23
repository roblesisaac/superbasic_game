export type StarType = 'small' | 'bright';

export interface Star {
  x: number;
  y: number;
  type: StarType;
  baseAlpha: number;
  twinkleSpeed: number;
  offset: number;
  currentAlpha?: number;
}

export interface Cloud {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  pixelSize: number;
  seed: number;
  octaves: number;
}

export interface StarfieldConfig {
  baseWidth: number;
  baseHeight: number;
  baseMoonRadius: number;
  numSmallStars: number;
  numBrightStars: number;
  cloudCount: number;
  cloudSize: number;
  cloudSpeed: number;
  cloudDetail: number;
}

export interface StarfieldState {
  stars: Star[];
  clouds: Cloud[];
  config: StarfieldConfig;
  rng: () => number;
}

export interface SceneDimensions {
  width: number;
  height: number;
  moonX: number;
  moonY: number;
  moonRadius: number;
  pixelSize: number;
}

export const DEFAULT_STARFIELD_CONFIG: StarfieldConfig = {
  baseWidth: 1024,
  baseHeight: 768,
  baseMoonRadius: 60,
  numSmallStars: 250,
  numBrightStars: 40,
  cloudCount: 5,
  cloudSize: 1,
  cloudSpeed: 1,
  cloudDetail: 4,
};

type Dimensions = { width: number; height: number };

function defaultRng(): number {
  return Math.random();
}

export function computeStarCounts(
  dimensions: Dimensions,
  config: StarfieldConfig = DEFAULT_STARFIELD_CONFIG
): { small: number; bright: number } {
  const area = Math.max(dimensions.width * dimensions.height, 1);
  const baseArea = config.baseWidth * config.baseHeight;
  const ratio = area / baseArea;

  const small = Math.max(40, Math.round(config.numSmallStars * ratio));
  const bright = Math.max(8, Math.round(config.numBrightStars * ratio));

  return { small, bright };
}

export function computeSceneDimensions(
  dimensions: Dimensions,
  config: StarfieldConfig = DEFAULT_STARFIELD_CONFIG
): SceneDimensions {
  const moonRadius =
    (Math.min(dimensions.width, dimensions.height) / config.baseHeight) *
    config.baseMoonRadius;
  const scaledRadius = Math.max(20, moonRadius);
  const pixelSize = Math.max(3, Math.round(scaledRadius / 20));

  return {
    width: dimensions.width,
    height: dimensions.height,
    moonX: dimensions.width * 0.65,
    moonY: dimensions.height * 0.22,
    moonRadius: scaledRadius,
    pixelSize,
  };
}

function createStars(
  dimensions: Dimensions,
  config: StarfieldConfig,
  rng: () => number
): Star[] {
  const stars: Star[] = [];
  const { small, bright } = computeStarCounts(dimensions, config);

  for (let i = 0; i < small; i += 1) {
    stars.push({
      x: rng() * dimensions.width,
      y: rng() * dimensions.height,
      type: 'small',
      baseAlpha: rng() * 0.5,
      twinkleSpeed: 1 + rng() * 2,
      offset: rng() * Math.PI * 2,
    });
  }

  for (let i = 0; i < bright; i += 1) {
    stars.push({
      x: rng() * dimensions.width,
      y: rng() * dimensions.height,
      type: 'bright',
      baseAlpha: 0.7 + rng() * 0.3,
      twinkleSpeed: 0.5 + rng(),
      offset: rng() * Math.PI * 2,
    });
  }

  return stars;
}

function createClouds(
  dimensions: Dimensions,
  config: StarfieldConfig,
  rng: () => number
): Cloud[] {
  const clouds: Cloud[] = [];

  for (let i = 0; i < Math.max(0, Math.round(config.cloudCount)); i += 1) {
    const baseWidth = 120 + rng() * 160;
    const baseHeight = 30 + rng() * 55;
    const cloudWidth = baseWidth * config.cloudSize;
    const cloudHeight = baseHeight * config.cloudSize;

    clouds.push({
      x: rng() * (dimensions.width + cloudWidth) - cloudWidth,
      y: rng() * dimensions.height * 0.7,
      width: cloudWidth,
      height: cloudHeight,
      speed: (5 + rng() * 15) * config.cloudSpeed,
      pixelSize: Math.max(1, Math.round(3 * config.cloudSize)),
      seed: rng() * 1000,
      octaves: Math.max(1, Math.round(config.cloudDetail)),
    });
  }

  return clouds;
}

export function createStarfieldState(
  dimensions: Dimensions,
  options: Partial<StarfieldConfig> = {},
  rng: () => number = defaultRng
): StarfieldState {
  const config: StarfieldConfig = {
    ...DEFAULT_STARFIELD_CONFIG,
    ...options,
  };

  return {
    stars: createStars(dimensions, config, rng),
    clouds: createClouds(dimensions, config, rng),
    config,
    rng,
  };
}

export function updateStarfield(
  state: StarfieldState,
  dimensions: Dimensions,
  dt: number
): void {
  for (const star of state.stars) {
    star.offset += dt * star.twinkleSpeed;
    const alpha = star.baseAlpha + Math.sin(star.offset) * 0.5;
    star.currentAlpha = Math.max(0.2, Math.min(1, alpha));
  }

  for (const cloud of state.clouds) {
    cloud.x += cloud.speed * dt;

    if (cloud.x > dimensions.width + cloud.width) {
      cloud.x = -cloud.width;
      cloud.y = state.rng() * dimensions.height * 0.7;
    }
  }
}

export const DEFAULT_GROUND_OFFSET = 116;

export function computeGroundLineY(
  canvasHeight: number,
  ground: number,
  camera: number,
  fallbackOffset: number = DEFAULT_GROUND_OFFSET
): number {
  const fallback = canvasHeight - fallbackOffset;
  const baseGround = Number.isFinite(ground) && ground > 0 ? ground : fallback;
  const line = baseGround - camera;
  if (!Number.isFinite(line)) return fallback;
  return line;
}
