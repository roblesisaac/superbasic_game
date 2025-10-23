export type PolyominoEdge = 'left' | 'right' | 'top' | 'bottom';

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

export function generatePolyomino(
  seed: number,
  minSize = 4,
  maxSize = 9
): PolyominoCellSet {
  const target = randInt(minSize, maxSize, seed);
  const cells: PolyominoCellSet = new Set(['0,0']);

  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  let attempts = 0;
  while (cells.size < target && attempts < target * 10) {
    const arr = Array.from(cells);
    const anchorIndex = randInt(0, arr.length - 1, seed + attempts);
    const [x, y] = arr[anchorIndex]?.split(',').map(Number) ?? [0, 0];
    const dirIndex = randInt(0, dirs.length - 1, seed + attempts + 1000);
    const [dx, dy] = dirs[dirIndex];
    const nx = x + dx;
    const ny = y + dy;
    const key = `${nx},${ny}`;
    if (!cells.has(key)) cells.add(key);
    attempts += 1;
  }

  let minX = Infinity;
  let minY = Infinity;
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }

  const normalized: PolyominoCellSet = new Set();
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    normalized.add(`${x - minX},${y - minY}`);
  }

  return normalized;
}

export function getPolyominoBounds(cells: PolyominoCellSet): PolyominoBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function flattenPolyominoEdge(
  cells: PolyominoCellSet,
  side: PolyominoEdge
): PolyominoCellSet {
  const bounds = getPolyominoBounds(cells);
  const map = new Map<number, number[]>();

  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    const primary = side === 'top' || side === 'bottom' ? x : y;
    const secondary = side === 'top' || side === 'bottom' ? y : x;
    const arr = map.get(primary);
    if (arr) arr.push(secondary);
    else map.set(primary, [secondary]);
  }

  const addCell = (x: number, y: number) => cells.add(`${x},${y}`);

  if (side === 'right') {
    for (let y = 0; y < bounds.h; y += 1) {
      const arr = map.get(y) ?? [];
      const max = arr.length ? Math.max(...arr) : -Infinity;
      for (let x = max + 1; x <= bounds.maxX; x += 1) addCell(x, y);
    }
  } else if (side === 'left') {
    for (let y = 0; y < bounds.h; y += 1) {
      const arr = map.get(y) ?? [];
      const min = arr.length ? Math.min(...arr) : Infinity;
      const limit = Number.isFinite(min) ? min - 1 : bounds.maxX;
      for (let x = 0; x <= limit; x += 1) addCell(x, y);
    }
  } else if (side === 'top') {
    for (let x = 0; x < bounds.w; x += 1) {
      const arr = map.get(x) ?? [];
      const min = arr.length ? Math.min(...arr) : Infinity;
      const limit = Number.isFinite(min) ? min - 1 : bounds.maxY;
      for (let y = 0; y <= limit; y += 1) addCell(x, y);
    }
  } else if (side === 'bottom') {
    for (let x = 0; x < bounds.w; x += 1) {
      const arr = map.get(x) ?? [];
      const max = arr.length ? Math.max(...arr) : -Infinity;
      for (let y = max + 1; y <= bounds.maxY; y += 1) addCell(x, y);
    }
  }

  return cells;
}

export function polyominoToOffsets(cells: PolyominoCellSet): PolyominoOffsets {
  const offsets: PolyominoOffsets = [];
  for (const key of cells) {
    const [cx, cy] = key.split(',').map(Number);
    offsets.push([cx, cy]);
  }
  return offsets;
}
