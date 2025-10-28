// Boulder generation and rendering module
// Extracted from boulder.html for reuse in game
// Optimized with caching and off-canvas rendering

export interface BoulderSettings {
  // Size and shape
  radius: number; // Base radius of the boulder in pixels
  segments: number; // Number of polygon segments (lower = more angular, higher = smoother)
  roughness: number; // How bumpy the surface is (0 = perfect circle, 1 = very rough)
  noiseOctaves: number; // Layers of detail in the roughness (more = more complex surface)

  // Lighting (white particles = lit areas, black/empty = shadows)
  lightAngle: number; // Direction light comes from in degrees (0 = right, 90 = down, 180 = left)
  litCoverage: number; // How much of the boulder is lit (0 = none, 0.5 = half, 1 = fully lit)
  litDensity: number; // Particle density in lit areas (0 = none, 1 = completely filled)
  litEdgeFade: number; // How much lighting fades near shadow edges (0 = no fade, 1 = strong fade)
  litMinSize: number; // Minimum pixel size for lit particles
  litMaxSize: number; // Maximum pixel size for lit particles

  // Outline
  outlineDensity: number; // Outline particle density (0 = none, 1 = solid line)
  outlineSize: number; // Pixel size of outline particles
}

export const DEFAULT_BOULDER_SETTINGS: BoulderSettings = {
  // Size and shape
  radius: 20,
  segments: 16,
  roughness: 0.35,
  noiseOctaves: 2,

  // Lighting
  litCoverage: 0.5,
  litDensity: 0.4,
  litEdgeFade: 1,
  lightAngle: 30,
  litMinSize: 1,
  litMaxSize: 3,

  // Outline
  outlineDensity: 0.5, // 50% outline density
  outlineSize: 2,
};

// Cache configuration
const MAX_CACHE_SIZE = 20; // Maximum number of cached boulders
const boulderCache = new Map<string, HTMLCanvasElement>();

// Generate cache key from settings and seed
function getCacheKey(
  settings: BoulderSettings,
  seed: number | undefined
): string {
  return `${settings.radius}_${settings.segments}_${settings.roughness}_${settings.noiseOctaves}_${settings.litCoverage}_${settings.litDensity}_${settings.lightAngle}_${settings.litEdgeFade}_${settings.litMinSize}_${settings.litMaxSize}_${settings.outlineDensity}_${settings.outlineSize}_${seed ?? "default"}`;
}

// Clear oldest cache entries when limit is reached
function pruneCache(): void {
  if (boulderCache.size >= MAX_CACHE_SIZE) {
    const firstKey = boulderCache.keys().next().value;
    if (firstKey) {
      boulderCache.delete(firstKey);
    }
  }
}

interface Point {
  x: number;
  y: number;
}

interface Particle extends Point {
  edgeDist: number;
  dot: number;
}

interface OutlineParticle extends Point {
  intensity: number;
}

// Fast pseudo-random number generator
class Random {
  private s: number[];

  constructor(seed: number = Date.now()) {
    this.s = [seed, seed * 2, seed * 3, seed * 4];
  }

  next(): number {
    const t = this.s[1] << 9;
    const r = this.s[0] * 5;
    const result = ((r << 7) | (r >>> 25)) * 9;

    this.s[2] ^= this.s[0];
    this.s[3] ^= this.s[1];
    this.s[1] ^= this.s[2];
    this.s[0] ^= this.s[3];
    this.s[2] ^= t;
    this.s[3] = (this.s[3] << 11) | (this.s[3] >>> 21);

    return (result >>> 0) / 4294967296;
  }
}

// Point in polygon test (optimized)
function pointInPolygon(x: number, y: number, points: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x,
      yi = points[i].y;
    const xj = points[j].x,
      yj = points[j].y;

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Distance to nearest edge
function distanceToEdge(x: number, y: number, points: Point[]): number {
  let minDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];

    const A = x - p1.x;
    const B = y - p1.y;
    const C = p2.x - p1.x;
    const D = p2.y - p1.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx: number, yy: number;
    if (param < 0) {
      xx = p1.x;
      yy = p1.y;
    } else if (param > 1) {
      xx = p2.x;
      yy = p2.y;
    } else {
      xx = p1.x + param * C;
      yy = p1.y + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

function generateBoulderPoints(
  centerX: number,
  centerY: number,
  settings: BoulderSettings,
  rng: Random
): Point[] {
  const points: Point[] = [];
  const segments = Math.floor(settings.segments);
  const noiseValues = new Array(segments);

  // Generate noise
  for (let i = 0; i < segments; i++) {
    let noise = 0;
    let amplitude = 1;
    let frequency = 1;

    for (let o = 0; o < settings.noiseOctaves; o++) {
      const angle = (i / segments) * frequency;
      noise += Math.sin(angle * Math.PI * 2 + rng.next() * 10) * amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }

    noiseValues[i] = noise;
  }

  // Smooth the noise
  for (let i = 0; i < segments; i++) {
    const prev = noiseValues[(i - 1 + segments) % segments];
    const curr = noiseValues[i];
    const next = noiseValues[(i + 1) % segments];
    noiseValues[i] = (prev + curr * 2 + next) * 0.25;
  }

  // Generate points
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const radiusVariation = 1 + noiseValues[i] * settings.roughness;
    const radius = settings.radius * radiusVariation;

    points.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    });
  }

  return points;
}

/**
 * Internal function to render boulder to an off-canvas context
 * This does the actual expensive rendering work
 */
function renderBoulderToCanvas(
  settings: BoulderSettings,
  seed: number | undefined
): HTMLCanvasElement {
  const rng = new Random(seed);

  // Calculate canvas size based on radius (with padding for outline)
  const padding = Math.ceil(settings.outlineSize * 2);
  const canvasSize = Math.ceil(settings.radius * 2 * 1.5) + padding * 2;
  const centerX = canvasSize / 2;
  const centerY = canvasSize / 2;

  // Create off-canvas
  const offCanvas = document.createElement("canvas");
  offCanvas.width = canvasSize;
  offCanvas.height = canvasSize;
  const ctx = offCanvas.getContext("2d")!;

  // Clear to transparent
  ctx.clearRect(0, 0, canvasSize, canvasSize);

  const points = generateBoulderPoints(centerX, centerY, settings, rng);

  // Calculate light direction
  const lightRad = (settings.lightAngle * Math.PI) / 180;
  const lightX = Math.cos(lightRad);
  const lightY = Math.sin(lightRad);

  // Generate lit particles (white particles = lit areas)
  const particles: Particle[] = [];
  const baseParticleCount = 2000; // Base count for 100% density
  // Use cubic curve for much more gradual density control at low values
  // This makes 0.1 -> 0.001 (0.1%), 0.5 -> 0.125 (12.5%), 1.0 -> 1.0 (100%)
  const densityCurve = Math.pow(settings.litDensity, 3);
  const numParticles = Math.floor(baseParticleCount * densityCurve);

  // Find bounding box
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  points.forEach((p) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });

  // Generate particles in lit region
  let attempts = 0;
  const maxAttempts = numParticles * 3;

  while (particles.length < numParticles && attempts < maxAttempts) {
    attempts++;
    const x = minX + rng.next() * (maxX - minX);
    const y = minY + rng.next() * (maxY - minY);

    if (pointInPolygon(x, y, points)) {
      // Calculate angle from center
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;

        // Dot product with light direction
        const dot = nx * lightX + ny * lightY;

        // Only draw lit particles on the side facing the light
        // litCoverage: 0 = no lit area, 0.5 = half lit, 1 = fully lit
        // Convert to threshold: coverage 0 -> threshold 1 (nothing passes)
        //                       coverage 0.5 -> threshold 0 (half passes)
        //                       coverage 1 -> threshold -1 (everything passes)
        const threshold = 1 - settings.litCoverage * 2;
        if (dot > threshold) {
          const edgeDist = distanceToEdge(x, y, points);
          particles.push({ x, y, edgeDist, dot });
        }
      }
    }
  }

  // Draw lit particles (white on black = lighting effect)
  const maxEdgeDist = settings.radius * 0.5;

  // Calculate light/shadow boundary for gradient
  const lightThreshold = 1 - settings.litCoverage * 2;

  particles.forEach((p) => {
    // Calculate distance from shadow boundary for gradient effect
    // p.dot ranges from lightThreshold (at shadow boundary) to 1 (at lit edge)
    // Normalize to 0-1 range: 0 = at shadow boundary, 1 = at lit edge
    const litRange = 1 - lightThreshold; // Total range of lit area
    const distFromBoundary = (p.dot - lightThreshold) / litRange;
    const gradientFactor = Math.max(0, Math.min(1, distFromBoundary));

    // litEdgeFade controls particle density gradient from lit edge toward shadow boundary
    // 0 = no fade (uniform density, hard edge at shadow boundary)
    // 1 = strong fade (gradient from bright at lit edge to dark at shadow boundary)
    if (settings.litEdgeFade > 0) {
      // gradientFactor: 0 = at shadow boundary, 1 = at lit edge
      // When litEdgeFade = 0: keep all (no gradient)
      // When litEdgeFade = 1: keepProbability = gradientFactor (0 at shadow, 1 at lit edge)
      const keepProbability =
        gradientFactor + (1 - gradientFactor) * (1 - settings.litEdgeFade);
      if (rng.next() > keepProbability) return;
    }

    // Vary particle size based on distance from boulder edge
    const edgeFactor = 1 - Math.min(p.edgeDist / maxEdgeDist, 1);
    const sizeRange = settings.litMaxSize - settings.litMinSize;
    const size = settings.litMinSize + edgeFactor * sizeRange;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(p.x, p.y, size, size);
  });

  // Draw boulder outline with particles (only on shadow side for definition)
  const outlineParticles: OutlineParticle[] = [];
  const totalPerimeter = points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length];
    const dx = next.x - p.x;
    const dy = next.y - p.y;
    return sum + Math.sqrt(dx * dx + dy * dy);
  }, 0);

  // outlineDensity: 0 = no outline, 1 = solid line (1 particle per pixel)
  const particlesPerUnit = settings.outlineDensity;
  const totalOutlineParticles = Math.floor(totalPerimeter * particlesPerUnit);

  // Distribute particles along the outline
  let particlesPlaced = 0;
  for (
    let i = 0;
    i < points.length && particlesPlaced < totalOutlineParticles;
    i++
  ) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);
    const particlesInSegment = Math.floor(segmentLength * particlesPerUnit);

    for (
      let j = 0;
      j < particlesInSegment && particlesPlaced < totalOutlineParticles;
      j++
    ) {
      const t = j / particlesInSegment;
      const x = p1.x + dx * t;
      const y = p1.y + dy * t;

      // Calculate normal direction at this point
      const px = x - centerX;
      const py = y - centerY;
      const pDist = Math.sqrt(px * px + py * py);

      if (pDist > 0) {
        const nx = px / pDist;
        const ny = py / pDist;

        // Dot product with light direction
        const dot = nx * lightX + ny * lightY;

        // Show outline on shadow side (dot > 0, facing away from light)
        // This adds definition to the dark areas
        const intensity = Math.max(0, dot);

        outlineParticles.push({ x, y, intensity });
      }
      particlesPlaced++;
    }
  }

  // Draw outline particles with gradient based on light direction
  outlineParticles.forEach((p) => {
    // Random culling based on intensity for gradual fade
    if (rng.next() < p.intensity) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(p.x, p.y, settings.outlineSize, settings.outlineSize);
    }
  });

  return offCanvas;
}

/**
 * Draw a procedurally generated boulder with particle-based shading
 * Uses caching and off-canvas rendering for optimal performance
 * @param ctx Canvas rendering context
 * @param centerX Center X position
 * @param centerY Center Y position
 * @param settings Boulder appearance settings
 * @param seed Random seed for reproducible generation
 * @param clearBackground Whether to clear the canvas background (default: false)
 */
export function drawBoulder(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  settings: BoulderSettings = DEFAULT_BOULDER_SETTINGS,
  seed?: number,
  clearBackground: boolean = false
): void {
  // Clear canvas if requested
  if (clearBackground) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // Check cache
  const cacheKey = getCacheKey(settings, seed);
  let cachedCanvas = boulderCache.get(cacheKey);

  // Generate and cache if not found
  if (!cachedCanvas) {
    pruneCache();
    cachedCanvas = renderBoulderToCanvas(settings, seed);
    boulderCache.set(cacheKey, cachedCanvas);
  }

  // Blit cached boulder to target context
  // Center the boulder at the requested position
  const halfSize = cachedCanvas.width / 2;
  ctx.drawImage(cachedCanvas, centerX - halfSize, centerY - halfSize);
}

/**
 * Clear the boulder cache (useful for memory management)
 */
export function clearBoulderCache(): void {
  boulderCache.clear();
}

/**
 * Get current cache size (for debugging/monitoring)
 */
export function getBoulderCacheSize(): number {
  return boulderCache.size;
}
