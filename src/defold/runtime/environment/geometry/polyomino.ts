// Density controls for rock generation (0.0 = fully hollow, 1.0 = fully solid)
const POLYOMINO_DENSITY_SINGLE = 0.6; // Single layer blocks (40% hollow chance)
const POLYOMINO_DENSITY_OUTER = 0.6; // Outer layer of double-layer blocks (10% hollow chance)
const POLYOMINO_DENSITY_INNER = 0.1; // Inner layer of double-layer blocks (60% hollow chance)

// Hollow intensity when hollowing occurs (0.0 = no holes, 1.0 = maximum holes)
const POLYOMINO_HOLLOW_INTENSITY_LOW = 0.15;
const POLYOMINO_HOLLOW_INTENSITY_HIGH = 0.25;

export type PolyominoEdge = "left" | "right" | "top" | "bottom";

export type PolyominoCellSet = Set<string>;

export type PolyominoOffsets = Array<readonly [number, number]>;

export interface PolyominoBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
}

export function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function randInt(min: number, max: number, seed: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

function seededChoice<T>(arr: T[], seed: number): T {
  return arr[Math.floor(seededRandom(seed) * arr.length)];
}

export function generatePolyomino(
  seed: number,
  minSize = 4,
  maxSize = 9
): PolyominoCellSet {
  const h = randInt(Math.max(3, minSize), maxSize, seed);
  const isLeftPerfect = seededRandom(seed + 1) < 0.35;
  const width = randInt(3, 5, seed + 2);

  // Use single layer with density-controlled hollowing
  return generateSingleLayer(
    seed,
    h,
    width,
    isLeftPerfect,
    1 - POLYOMINO_DENSITY_SINGLE
  );
}

function generateSingleLayer(
  seed: number,
  h: number,
  width: number,
  isLeftPerfect: boolean,
  hollowChance: number
): PolyominoCellSet {
  const cells: PolyominoCellSet = new Set();
  let leftInset = 0;
  let currentWidth = width;

  for (let y = 0; y < h; y++) {
    let tempNick = 0;

    if (!isLeftPerfect && seededRandom(seed + y * 100) < 0.18) {
      leftInset += seededChoice([-1, 0, 0, 1], seed + y * 101);
      leftInset = Math.max(0, Math.min(2, leftInset));
    }

    if (!isLeftPerfect && seededRandom(seed + y * 102) < 0.06) {
      tempNick = 1;
    }

    if (seededRandom(seed + y * 200) < 0.6) {
      currentWidth += seededChoice([-1, 0, 0, 1], seed + y * 201);
      currentWidth = Math.max(3, Math.min(6, currentWidth));
    }

    const notch =
      seededRandom(seed + y * 300) < 0.18
        ? randInt(1, Math.max(1, currentWidth - 2), seed + y * 301)
        : null;

    const rowLeft = isLeftPerfect ? 0 : leftInset + tempNick;

    for (let x = 0; x < currentWidth; x++) {
      if (notch !== null && x === notch) continue;
      cells.add(`${rowLeft + x},${y}`);
    }
  }

  // Floating pixels
  if (h >= 3) {
    const nFloat = randInt(2, 4, seed + 400);
    for (let i = 0; i < nFloat; i++) {
      const ry = randInt(1, h - 2, seed + 500 + i);
      let rowRight = 0;
      for (let x = 0; x < 10; x++) {
        if (cells.has(`${x},${ry}`)) rowRight = x;
      }
      const fx = rowRight + 1;
      const fyOffset = seededChoice([-1, 0, 0, 1], seed + 700 + i);
      const fy = Math.max(0, Math.min(h - 1, ry + fyOffset));
      cells.add(`${fx},${fy}`);
    }
  }

  // Hollowing
  if (seededRandom(seed + 800) < hollowChance && h >= 4 && currentWidth >= 4) {
    const bounds = getPolyominoBounds(cells);
    const hollowIntensity =
      seededRandom(seed + 801) < 0.5
        ? POLYOMINO_HOLLOW_INTENSITY_LOW
        : POLYOMINO_HOLLOW_INTENSITY_HIGH;

    for (const key of Array.from(cells)) {
      const [x, y] = key.split(",").map(Number);
      const isInterior =
        x > bounds.minX &&
        x < bounds.maxX &&
        y > bounds.minY &&
        y < bounds.maxY;

      if (
        isInterior &&
        seededRandom(seed + x * 1000 + y * 2000) < hollowIntensity
      ) {
        cells.delete(key);
      }
    }
  }

  return cells;
}

export function generatePolyominoWithLayers(
  seed: number,
  minSize = 4,
  maxSize = 9,
  edge: PolyominoEdge = "left"
): PolyominoCellSet {
  const combined: PolyominoCellSet = new Set();

  const h = randInt(Math.max(3, minSize), maxSize, seed);
  const isLeftPerfect = seededRandom(seed + 1) < 0.35;
  const baseWidth = randInt(3, 5, seed + 2);

  // First layer - solid outer layer with straight edge
  const layer1 = generateSingleLayer(
    seed,
    h,
    baseWidth,
    isLeftPerfect,
    1 - POLYOMINO_DENSITY_OUTER
  );

  // Second layer - more porous inner layer
  const layer2 = generateSingleLayer(
    seed + 5000,
    h,
    baseWidth,
    false,
    1 - POLYOMINO_DENSITY_INNER
  );

  // Position layers based on edge
  const bounds1 = getPolyominoBounds(layer1);

  for (const key of layer1) {
    combined.add(key);
  }

  for (const key of layer2) {
    const [x, y] = key.split(",").map(Number);
    let newX = x;
    let newY = y;

    if (edge === "left" || edge === "right") {
      // Stack horizontally
      newX = edge === "left" ? x + bounds1.w : x - bounds1.w;
    } else {
      // Stack vertically
      newY = edge === "top" ? y + bounds1.h : y - bounds1.h;
    }

    combined.add(`${newX},${newY}`);
  }

  return combined;
}

export function getPolyominoBounds(cells: PolyominoCellSet): PolyominoBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const key of cells) {
    const [x, y] = key.split(",").map(Number);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function flattenPolyominoEdge(
  cells: PolyominoCellSet,
  side: PolyominoEdge,
  useDoubleLayers = true
): PolyominoCellSet {
  // If double layers requested, generate layered version before flattening
  if (useDoubleLayers) {
    // Extract seed from cell pattern (use a hash of the cells)
    let seedHash = 0;
    for (const key of cells) {
      const [x, y] = key.split(",").map(Number);
      seedHash = (seedHash * 31 + x * 17 + y * 13) | 0;
    }

    const bounds = getPolyominoBounds(cells);
    const h = bounds.h;
    const w = bounds.w;

    // Generate double-layer version
    const layered = generatePolyominoWithLayers(
      Math.abs(seedHash),
      Math.max(3, Math.min(h, w)),
      Math.max(h, w),
      side
    );

    cells = layered;
  }

  // Remove floating pixels before flattening to avoid huge bounds
  const mainCells: PolyominoCellSet = new Set();
  const bounds = getPolyominoBounds(cells);

  // Filter out isolated floating pixels by only keeping cells connected to main mass
  for (const key of cells) {
    const [x, y] = key.split(",").map(Number);
    // Keep cells that are within reasonable distance from minX/minY
    const distFromLeft = x - bounds.minX;
    const distFromTop = y - bounds.minY;
    if (distFromLeft <= bounds.w * 0.8 && distFromTop <= bounds.h * 0.8) {
      mainCells.add(key);
    }
  }

  const filteredBounds = getPolyominoBounds(mainCells);
  const map = new Map<number, number[]>();

  for (const key of mainCells) {
    const [x, y] = key.split(",").map(Number);
    const primary = side === "top" || side === "bottom" ? x : y;
    const secondary = side === "top" || side === "bottom" ? y : x;
    const arr = map.get(primary);
    if (arr) arr.push(secondary);
    else map.set(primary, [secondary]);
  }

  const addCell = (x: number, y: number) => mainCells.add(`${x},${y}`);

  if (side === "right") {
    for (let y = 0; y < filteredBounds.h; y += 1) {
      const arr = map.get(y) ?? [];
      const max = arr.length ? Math.max(...arr) : -Infinity;
      for (let x = max + 1; x <= filteredBounds.maxX; x += 1) addCell(x, y);
    }
  } else if (side === "left") {
    for (let y = 0; y < filteredBounds.h; y += 1) {
      const arr = map.get(y) ?? [];
      const min = arr.length ? Math.min(...arr) : Infinity;
      const limit = Number.isFinite(min) ? min - 1 : filteredBounds.maxX;
      for (let x = 0; x <= limit; x += 1) addCell(x, y);
    }
  } else if (side === "top") {
    for (let x = 0; x < filteredBounds.w; x += 1) {
      const arr = map.get(x) ?? [];
      const min = arr.length ? Math.min(...arr) : Infinity;
      const limit = Number.isFinite(min) ? min - 1 : filteredBounds.maxY;
      for (let y = 0; y <= limit; y += 1) addCell(x, y);
    }
  } else if (side === "bottom") {
    for (let x = 0; x < filteredBounds.w; x += 1) {
      const arr = map.get(x) ?? [];
      const max = arr.length ? Math.max(...arr) : -Infinity;
      for (let y = max + 1; y <= filteredBounds.maxY; y += 1) addCell(x, y);
    }
  }

  return mainCells;
}

export function polyominoToOffsets(cells: PolyominoCellSet): PolyominoOffsets {
  const offsets: PolyominoOffsets = [];
  for (const key of cells) {
    const [cx, cy] = key.split(",").map(Number);
    offsets.push([cx, cy]);
  }
  return offsets;
}
