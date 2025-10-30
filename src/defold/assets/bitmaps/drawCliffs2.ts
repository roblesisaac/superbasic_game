// Cliff generation and rendering module
// Extracted from cliffs.html for reuse in game
// Optimized with offscreen canvas rendering to prevent flickering

import {
  drawBoulder,
  BoulderSettings,
  DEFAULT_BOULDER_SETTINGS,
} from "./drawBoulder.js";

export interface CliffSettings {
  edgeLineIntensity: number;
  edgeLinePixelSize: number;
  edgeParticleDensity: number;
  edgeParticleMinPixelSize: number;
  edgeParticleMaxPixelSize: number;
  boulderCount: number;
  boulderSettings: BoulderSettings;
  boulderMinDistance: number;
  boulderMaxDistance: number;
  maxWidth: number;
  segmentHeight: number;
}

const PIXEL_SIZE: number = 3;

export const DEFAULT_CLIFF_SETTINGS: CliffSettings = {
  edgeLineIntensity: 35,
  edgeParticleDensity: 400,
  edgeLinePixelSize: PIXEL_SIZE,
  edgeParticleMinPixelSize: PIXEL_SIZE,
  edgeParticleMaxPixelSize: PIXEL_SIZE,
  boulderCount: 2,
  boulderSettings: {
    ...DEFAULT_BOULDER_SETTINGS,
  },
  boulderMinDistance: 10,
  boulderMaxDistance: 60,
  maxWidth: 0.4,
  segmentHeight: 80,
};

interface PathPoint {
  y: number;
  width: number;
}

interface Particle {
  x: number;
  y: number;
  width: number;
  size: number;
}

interface Boulder {
  centerX: number;
  centerY: number;
  width: number;
  seed: number;
  lightAngle: number;
}

interface EdgeLineParticle {
  x: number;
  y: number;
}

export class CliffSegment {
  side: "left" | "right";
  y: number;
  height: number;
  currentWidth: number;
  endWidth: number;
  pathPoints: PathPoint[];
  particles: Particle[];
  boulders: Boulder[];
  edgeLineParticles: EdgeLineParticle[];
  offscreenCanvas: HTMLCanvasElement | null;
  offscreenCtx: CanvasRenderingContext2D | null;
  cachedCanvasWidth: number;

  constructor(
    side: "left" | "right",
    prevSegment: CliffSegment | null,
    canvasWidth: number,
    settings: CliffSettings
  ) {
    this.side = side;
    const maxW = canvasWidth * settings.maxWidth;

    if (!prevSegment) {
      this.y = 0;
      this.currentWidth = Math.random() * maxW * 0.3 + maxW * 0.2;
    } else {
      this.y = prevSegment.y + prevSegment.height;
      this.currentWidth = prevSegment.endWidth;
    }

    // Generate organic cliff edge
    const minH = 40;
    const maxH = 120;
    this.height = Math.random() * (maxH - minH) + minH;

    // Determine direction
    const moveInward =
      this.currentWidth < maxW * 0.3
        ? true
        : this.currentWidth > maxW * 0.7
          ? false
          : Math.random() > 0.5;

    // Calculate end width with variation
    const widthChange = Math.random() * maxW * 0.2 + maxW * 0.1;
    if (moveInward) {
      this.endWidth = Math.min(maxW, this.currentWidth + widthChange);
    } else {
      this.endWidth = Math.max(maxW * 0.05, this.currentWidth - widthChange);
    }

    // Initialize arrays
    this.pathPoints = [];
    this.particles = [];
    this.boulders = [];
    this.edgeLineParticles = [];
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.cachedCanvasWidth = canvasWidth;

    this.generatePath();
    this.generateEdgeLineParticles(settings);
    this.generateParticles(settings);
  }

  private generatePath(): void {
    const steps = 15;

    // First point connects exactly to the starting width
    this.pathPoints.push({ y: this.y, width: this.currentWidth });

    // Middle points have organic variation
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const y = this.y + t * this.height;
      const baseWidth =
        this.currentWidth + (this.endWidth - this.currentWidth) * t;

      // Add Perlin-like noise for organic variation
      const noise =
        Math.sin(t * Math.PI * 3 + this.y * 0.05) * 8 +
        Math.sin(t * Math.PI * 7 + this.y * 0.1) * 4 +
        Math.sin(t * Math.PI * 11 + this.y * 0.15) * 2;

      const width = baseWidth + noise;
      this.pathPoints.push({ y, width });
    }

    // Last point connects exactly to the ending width
    this.pathPoints.push({
      y: this.y + this.height,
      width: this.endWidth,
    });
  }

  private generateEdgeLineParticles(settings: CliffSettings): void {
    const intensity = settings.edgeLineIntensity / 100;

    for (let i = 0; i < this.pathPoints.length - 1; i++) {
      const point = this.pathPoints[i];
      const nextPoint = this.pathPoints[i + 1];

      const x1 = point.width;
      const y1 = point.y;
      const x2 = nextPoint.width;
      const y2 = nextPoint.y;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const numDots = Math.ceil(distance);
      for (let d = 0; d < numDots; d++) {
        // Use deterministic random based on position to prevent flickering
        const seed = (i * 1000 + d + this.y) * 0.12345;
        const random = Math.abs((Math.sin(seed) * 10000) % 1);

        if (random < intensity) {
          const t = d / numDots;
          this.edgeLineParticles.push({
            x: x1 + dx * t,
            y: y1 + dy * t,
          });
        }
      }
    }
  }

  private generateParticles(settings: CliffSettings): void {
    const densityMultiplier = settings.edgeParticleDensity / 100;
    const particleDensity = (this.height / 3) * densityMultiplier;

    // Main particles with exponential distribution toward edge
    for (let i = 0; i < particleDensity; i++) {
      const t = Math.random();
      const pointIdx = Math.floor(t * (this.pathPoints.length - 1));
      const point = this.pathPoints[pointIdx];

      // Generate size first
      const size =
        Math.floor(
          Math.random() *
            (settings.edgeParticleMaxPixelSize -
              settings.edgeParticleMinPixelSize +
              1)
        ) + settings.edgeParticleMinPixelSize;

      // Exponential distribution - most particles close to edge
      // Account for particle size so it doesn't protrude beyond edge
      const distFromEdge = Math.pow(Math.random(), 3) * 80;
      const offsetX = -(distFromEdge + size);
      const offsetY = (Math.random() - 0.5) * 10;

      this.particles.push({
        x: offsetX,
        y: point.y + offsetY,
        width: point.width,
        size,
      });
    }

    // Extra dense particles right at the edge
    const edgeParticles = (this.height / 2) * densityMultiplier;
    for (let i = 0; i < edgeParticles; i++) {
      const t = Math.random();
      const pointIdx = Math.floor(t * (this.pathPoints.length - 1));
      const point = this.pathPoints[pointIdx];

      // Generate size first
      const size =
        Math.floor(
          Math.random() *
            (settings.edgeParticleMaxPixelSize -
              settings.edgeParticleMinPixelSize +
              1)
        ) + settings.edgeParticleMinPixelSize;

      // Very close to edge (0-15 pixels) - account for particle size
      const offsetX = -(Math.random() * 15 + size);
      const offsetY = (Math.random() - 0.5) * 6;

      this.particles.push({
        x: offsetX,
        y: point.y + offsetY,
        width: point.width,
        size,
      });
    }

    // Generate boulder positions (will be rendered using drawBoulder)
    const numBoulders = settings.boulderCount;
    for (let c = 0; c < numBoulders; c++) {
      const boulderT = Math.random();
      const boulderPointIdx = Math.floor(
        boulderT * (this.pathPoints.length - 1)
      );
      const boulderPoint = this.pathPoints[boulderPointIdx];

      // Calculate boulder radius (from boulderSettings)
      const boulderRadius = settings.boulderSettings.radius;

      // Boulder center position - constrain so boulder doesn't extend past cliff edge
      // The boulder center must be at least boulderRadius pixels away from the edge
      const minDistance = Math.max(
        settings.boulderMinDistance,
        boulderRadius + 2
      );
      const maxDistance = Math.max(
        settings.boulderMaxDistance,
        minDistance + 10
      );

      const boulderCenterX = -(
        Math.random() * (maxDistance - minDistance) +
        minDistance
      );
      const boulderCenterY = boulderPoint.y;

      // Generate deterministic seed based on position
      const seed = Math.floor(
        (this.y + boulderCenterX + boulderCenterY) * 1000
      );

      // Light angle based on cliff side
      // Left cliff: light from upper-right (30-45 degrees)
      // Right cliff: light from upper-left (150-180 degrees)
      const lightAngle =
        this.side === "left"
          ? 270 + Math.random() * 5
          : 220 + Math.random() * 5;

      // Store boulder info for rendering
      this.boulders.push({
        centerX: boulderCenterX,
        centerY: boulderCenterY,
        width: boulderPoint.width,
        seed,
        lightAngle,
      });
    }
  }

  private ensureOffscreenCanvas(
    canvasWidth: number,
    settings: CliffSettings
  ): void {
    // Check if we need to create or recreate the offscreen canvas
    if (!this.offscreenCanvas || this.cachedCanvasWidth !== canvasWidth) {
      this.offscreenCanvas = document.createElement("canvas");
      this.offscreenCanvas.width = canvasWidth;
      this.offscreenCanvas.height = Math.ceil(this.height);
      this.offscreenCtx = this.offscreenCanvas.getContext("2d");
      this.cachedCanvasWidth = canvasWidth;

      if (this.offscreenCtx) {
        // Disable image smoothing for crisp pixel art
        this.offscreenCtx.imageSmoothingEnabled = false;
        this.renderToOffscreenCanvas(canvasWidth, settings);
      }
    }
  }

  private renderToOffscreenCanvas(
    canvasWidth: number,
    settings: CliffSettings
  ): void {
    if (!this.offscreenCtx) return;

    const ctx = this.offscreenCtx;

    // Clear
    ctx.clearRect(0, 0, canvasWidth, this.height);
    ctx.fillStyle = "#ffffff";

    // Draw pre-generated edge line particles
    for (const p of this.edgeLineParticles) {
      const x = this.side === "left" ? p.x : canvasWidth - p.x;
      const y = p.y - this.y; // Convert to local coordinates
      // Round to whole pixels to prevent sub-pixel antialiasing
      ctx.fillRect(
        Math.round(x),
        Math.round(y),
        settings.edgeLinePixelSize,
        settings.edgeLinePixelSize
      );
    }

    // Draw particles with checkered dithering
    for (const p of this.particles) {
      // For left cliff: edge at p.width, particles offset left (negative x)
      // For right cliff: edge at canvasWidth - p.width, particles offset right (negative x becomes positive offset)
      const centerX =
        this.side === "left" ? p.width + p.x : canvasWidth - p.width - p.x;
      const centerY = p.y - this.y; // Convert to local coordinates

      // Apply checkered dithering pattern
      // Particles are centered, so we offset by half size
      const pixelX = Math.floor(centerX - p.size / 2);
      const pixelY = Math.floor(centerY - p.size / 2);

      // Calculate edge position for bounds checking
      const edgeX = this.side === "left" ? p.width : canvasWidth - p.width;

      for (let dy = 0; dy < p.size; dy++) {
        for (let dx = 0; dx < p.size; dx++) {
          const px = pixelX + dx;
          const py = pixelY + dy;

          // Skip pixels that would extend beyond the cliff edge
          if (this.side === "left" && px > edgeX) continue;
          if (this.side === "right" && px < edgeX) continue;

          // Checkered pattern: draw pixel if (x + y) is even
          if ((px + py) % 2 === 0) {
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }
    }

    // Draw procedural boulders
    for (const boulder of this.boulders) {
      // For left cliff: edge at boulder.width, boulder offset left (negative centerX)
      // For right cliff: edge at canvasWidth - boulder.width, boulder offset right (negative centerX becomes positive offset)
      const x =
        this.side === "left"
          ? boulder.width + boulder.centerX
          : canvasWidth - boulder.width - boulder.centerX;
      const y = boulder.centerY - this.y; // Convert to local coordinates

      // Create boulder settings with side-specific light angle
      const boulderSettings: BoulderSettings = {
        ...settings.boulderSettings,
        lightAngle: boulder.lightAngle,
      };

      drawBoulder(ctx, x, y, boulderSettings, boulder.seed, false);
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    scrollY: number,
    canvasHeight: number,
    settings: CliffSettings,
    forceVisible: boolean = false
  ): void {
    // Only draw if visible or forced
    if (
      !forceVisible &&
      (this.y + this.height < scrollY - 50 ||
        this.y > scrollY + canvasHeight + 50)
    )
      return;

    // Ensure offscreen canvas is ready
    this.ensureOffscreenCanvas(canvasWidth, settings);

    // Blit the offscreen canvas to the main canvas
    if (this.offscreenCanvas) {
      // Disable image smoothing for crisp pixel art
      const prevSmoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;

      // Round to whole pixels to prevent sub-pixel antialiasing
      const screenY = Math.round(this.y - scrollY);
      ctx.drawImage(this.offscreenCanvas, 0, screenY);

      // Restore smoothing setting
      ctx.imageSmoothingEnabled = prevSmoothing;
    }
  }
}

export interface CliffState {
  scrollY: number;
  leftCliffs: CliffSegment[];
  rightCliffs: CliffSegment[];
  generatedUpTo: number;
  visibleRange: { start: number; end: number };
}

/**
 * Create initial cliff state
 */
export function createCliffState(): CliffState {
  return {
    scrollY: 0,
    leftCliffs: [],
    rightCliffs: [],
    generatedUpTo: 0,
    visibleRange: { start: 0, end: 0 },
  };
}

/**
 * Generate initial cliff segments
 */
export function generateInitialCliffs(
  state: CliffState,
  canvasWidth: number,
  canvasHeight: number,
  settings: CliffSettings
): void {
  const numSegments = Math.ceil(canvasHeight / settings.segmentHeight) + 5;

  state.leftCliffs = [];
  state.rightCliffs = [];

  for (let i = 0; i < numSegments; i++) {
    const prevLeft = state.leftCliffs[i - 1] || null;
    const prevRight = state.rightCliffs[i - 1] || null;

    state.leftCliffs.push(
      new CliffSegment("left", prevLeft, canvasWidth, settings)
    );
    state.rightCliffs.push(
      new CliffSegment("right", prevRight, canvasWidth, settings)
    );
  }

  // Track how far we've generated
  if (state.leftCliffs.length > 0) {
    state.generatedUpTo =
      state.leftCliffs[state.leftCliffs.length - 1].y +
      state.leftCliffs[state.leftCliffs.length - 1].height;
  }
}

/**
 * Generate new cliffs ahead (data only, kept forever)
 */
export function generateAhead(
  state: CliffState,
  canvasWidth: number,
  canvasHeight: number,
  settings: CliffSettings
): void {
  // Generate 2 screens ahead to prevent pop-in
  const bufferDistance = canvasHeight * 2;

  // Generate forward - data is kept forever
  while (state.generatedUpTo < state.scrollY + canvasHeight + bufferDistance) {
    const prevLeft = state.leftCliffs[state.leftCliffs.length - 1];
    const prevRight = state.rightCliffs[state.rightCliffs.length - 1];

    const newLeft = new CliffSegment("left", prevLeft, canvasWidth, settings);
    const newRight = new CliffSegment(
      "right",
      prevRight,
      canvasWidth,
      settings
    );

    state.leftCliffs.push(newLeft);
    state.rightCliffs.push(newRight);

    state.generatedUpTo = newLeft.y + newLeft.height;
  }

  // Update visible range for drawing (2 screens buffer on each side)
  state.visibleRange.start = Math.max(0, state.scrollY - canvasHeight * 2);
  state.visibleRange.end = state.scrollY + canvasHeight * 3;
}

/**
 * Find the index range of cliffs that should be drawn
 */
function getVisibleCliffIndices(state: CliffState): {
  startIdx: number;
  endIdx: number;
} {
  let startIdx = 0;
  let endIdx = state.leftCliffs.length;

  // Binary search for start index (first cliff that ends after visible start)
  for (let i = 0; i < state.leftCliffs.length; i++) {
    if (
      state.leftCliffs[i].y + state.leftCliffs[i].height >=
      state.visibleRange.start
    ) {
      startIdx = i;
      break;
    }
  }

  // Linear search from start for end index (first cliff that starts after visible end)
  for (let i = startIdx; i < state.leftCliffs.length; i++) {
    if (state.leftCliffs[i].y > state.visibleRange.end) {
      endIdx = i;
      break;
    }
  }

  return { startIdx, endIdx };
}

/**
 * Draw all visible cliffs
 */
export function drawCliffs(
  ctx: CanvasRenderingContext2D,
  state: CliffState,
  canvasWidth: number,
  canvasHeight: number,
  settings: CliffSettings,
  clearBackground: boolean = true
): void {
  // Clear with black if requested
  if (clearBackground) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // Get the range of cliffs that should be drawn
  const { startIdx, endIdx } = getVisibleCliffIndices(state);

  // Only draw cliffs within visible range
  for (let i = startIdx; i < endIdx; i++) {
    state.leftCliffs[i].draw(
      ctx,
      canvasWidth,
      state.scrollY,
      canvasHeight,
      settings
    );
    state.rightCliffs[i].draw(
      ctx,
      canvasWidth,
      state.scrollY,
      canvasHeight,
      settings
    );
  }
}
