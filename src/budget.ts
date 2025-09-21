import {
  TOTAL_ITEMS,
  MAX_ITEMS_PER_SECTION,
  GROUP_SPACING,
  ITEM_SPACING,
  PIXELS_PER_FOOT,
  DEFAULT_BUDGET_DATA
} from './constants.js';
import { Collectible, type CollectibleType, type GameStats } from './collectibles.js';
import { groundY, canvasWidth } from './globals.js';
import {
  getSectionDefinition,
  getSectionIndexForY as getSectionIndexForYFromManager,
  type SectionLayoutEntry,
  type NormalizedSectionDefinition,
  type CollectibleSpawn,
} from './sections.js';

export type BudgetEntry = [string, number];

export interface BudgetSection {
  id?: string;
  title: string;
  amount: number;
  itemCount: number;
  startFeet: number;
  endFeet: number;
  spawned: number;
  pendingEnemies: number;
}

export let budgetData: BudgetEntry[] = DEFAULT_BUDGET_DATA.map(
  ([title, amount]) => [title, amount] as BudgetEntry
);
export let budgetSections: BudgetSection[] = [];
export let collectibles: Collectible[] = [];
export let gameStats: GameStats = {};
export let preloadedSections: Set<number> = new Set();
export let createdGates: Set<number> = new Set();

export function resetBudgetContainers() {
  collectibles = [];
  preloadedSections = new Set();
  createdGates = new Set();
}

type FormationPosition = { x: number; y: number };
type FormationFn = (count: number, spacing: number) => FormationPosition[];

const FORMATIONS: Record<string, FormationFn> = {
  line: (count, spacing) => {
    const positions: FormationPosition[] = [];
    for (let i = 0; i < count; i++) positions.push({ x: i * spacing, y: 0 });
    return positions;
  },
  square: (count, spacing) => {
    if (count === 4) {
      return [
        { x: 0, y: 0 },
        { x: spacing, y: 0 },
        { x: 0, y: spacing },
        { x: spacing, y: spacing }
      ];
    }
    return FORMATIONS.line(count, spacing);
  },
  triangle: (count, spacing) => {
    if (count === 3) {
      return [
        { x: spacing / 2, y: 0 },
        { x: 0, y: spacing },
        { x: spacing, y: spacing }
      ];
    }
    return FORMATIONS.line(count, spacing);
  },
  pyramid: (count, spacing) => {
    if (count === 6) {
      return [
        { x: 0, y: spacing },
        { x: spacing, y: spacing },
        { x: spacing * 2, y: spacing },
        { x: spacing / 2, y: 0 },
        { x: spacing * 1.5, y: 0 },
        { x: spacing, y: -spacing }
      ];
    }
    return FORMATIONS.line(count, spacing);
  }
};

export function calculateBudgetSections(layout: SectionLayoutEntry[] = []) {
  const totalAmount = budgetData.reduce((sum, [, amount]) => sum + Math.abs(amount), 0);
  budgetSections = [];
  gameStats = {} as GameStats;
  let fallbackFeet = 0;
  let layoutIndex = 0;

  for (const [title, amount] of budgetData) {
    const percentage = totalAmount === 0 ? 0 : Math.abs(amount) / totalAmount;
    const itemCount = Math.round(TOTAL_ITEMS * percentage);
    const sectionsNeeded = Math.max(1, Math.ceil(itemCount / MAX_ITEMS_PER_SECTION));

    gameStats[title] = { target: amount, collected: 0, total: itemCount };

    for (let i = 0; i < sectionsNeeded; i++) {
      const itemsInThis = Math.min(MAX_ITEMS_PER_SECTION, itemCount - i * MAX_ITEMS_PER_SECTION);
      const layoutEntry = layout[layoutIndex];
      let startFeet: number;
      let endFeet: number;
      let id: string | undefined;

      if (layoutEntry) {
        ({ startFeet, endFeet, id } = layoutEntry);
        fallbackFeet = endFeet;
      } else {
        startFeet = fallbackFeet;
        endFeet = fallbackFeet + 100;
        fallbackFeet = endFeet;
      }

      budgetSections.push({
        id,
        title,
        amount,
        itemCount: Math.max(0, itemsInThis),
        startFeet,
        endFeet,
        spawned: 0,
        pendingEnemies: 0
      });
      layoutIndex++;
    }
  }
}

function createFormationGroup(
  baseX: number,
  baseY: number,
  groupSize: number,
  title: string,
  value: number,
  type: CollectibleType
): Collectible[] {
  const keys = Object.keys(FORMATIONS);
  const formationType = keys[Math.floor(Math.random() * keys.length)];
  const formation = FORMATIONS[formationType] ?? FORMATIONS.line;
  const positions = formation(groupSize, ITEM_SPACING);
  return positions.map(
    (pos) => new Collectible(baseX + pos.x, baseY + pos.y, value, title, type)
  );
}

function spawnCollectibleGroupFromDefinition(
  section: BudgetSection,
  spawn: CollectibleSpawn,
): number {
  const count = Math.max(0, Math.floor(spawn.count ?? 0));
  if (count <= 0) return 0;

  const sectionHeightFeet = Math.max(0, section.endFeet - section.startFeet);
  const offsetFeet = typeof spawn.offsetFeet === 'number' ? spawn.offsetFeet : 0;
  const clampedOffsetFeet = Math.max(0, Math.min(sectionHeightFeet, offsetFeet));
  const worldFeet = section.startFeet + clampedOffsetFeet;

  const xPercent = typeof spawn.xPercent === 'number' ? spawn.xPercent : 50;
  const baseX = (xPercent / 100) * Math.max(1, canvasWidth);
  const baseY = groundY - worldFeet * PIXELS_PER_FOOT;

  const spacingFeet =
    typeof spawn.spreadFeet === 'number'
      ? spawn.spreadFeet
      : ITEM_SPACING / PIXELS_PER_FOOT;
  const spacing = spacingFeet * PIXELS_PER_FOOT;

  const formationName = spawn.formation ?? 'line';
  const formation = FORMATIONS[formationName] ?? FORMATIONS.line;
  const positions = formation(count, spacing).slice(0, count);
  if (positions.length === 0) return 0;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const pos of positions) {
    if (pos.x < minX) minX = pos.x;
    if (pos.x > maxX) maxX = pos.x;
    if (pos.y < minY) minY = pos.y;
    if (pos.y > maxY) maxY = pos.y;
  }

  const offsetX = (minX + maxX) / 2;
  const offsetY = (minY + maxY) / 2;

  let spawned = 0;
  for (const pos of positions) {
    if (spawned >= count) break;
    const px = baseX + (pos.x - offsetX);
    const py = baseY + (pos.y - offsetY);
    const value = spawn.value ?? section.amount;
    const spawnType: CollectibleType =
      spawn.type === 'income'
        ? 'income'
        : value >= 0
        ? 'income'
        : 'expense';
    const title = spawn.title ?? section.title;
    collectibles.push(new Collectible(px, py, value, title, spawnType));
    spawned++;
  }

  return spawned;
}

function spawnCollectiblesFromSectionDefinition(
  section: BudgetSection,
  definition: NormalizedSectionDefinition,
): boolean {
  const collectibleSpawns = definition.collectibles ?? [];
  let totalSpawned = 0;

  if (collectibleSpawns.length > 0) {
    for (const spawn of collectibleSpawns) {
      totalSpawned += spawnCollectibleGroupFromDefinition(section, spawn);
    }
    if (totalSpawned > 0) section.spawned += totalSpawned;
    section.pendingEnemies = 0;
    return true;
  }

  const enemyPlan = definition.enemies ?? [];
  if (enemyPlan.length > 0) {
    const plannedTotal = enemyPlan.reduce(
      (sum, value) => sum + (typeof value === 'number' ? Math.max(0, value) : 0),
      0,
    );
    section.pendingEnemies = Math.max(0, plannedTotal - section.spawned);
    return true;
  }

  return false;
}

export function preloadSectionCollectibles(sectionIndex: number) {
  if (preloadedSections.has(sectionIndex)) return;
  const section = budgetSections[sectionIndex];
  if (!section) return;

  const definition = getSectionDefinition(sectionIndex);
  if (definition && spawnCollectiblesFromSectionDefinition(section, definition)) {
    preloadedSections.add(sectionIndex);
    return;
  }

  const sectionHeightFeet = Math.max(0, section.endFeet - section.startFeet);
  const sectionBaseY = groundY - section.startFeet * PIXELS_PER_FOOT;
  const sectionHeight = sectionHeightFeet * PIXELS_PER_FOOT;
  const type: CollectibleType = section.amount > 0 ? 'income' : 'expense';

  if (type === 'income') {
    let itemsToPlace = Math.max(0, Math.min(section.itemCount - section.spawned, section.itemCount));
    let currentY = sectionBaseY - 50;

    while (itemsToPlace > 0) {
      const groupSize = Math.min(itemsToPlace, Math.floor(Math.random() * 4) + 3);
      const groupBaseX = Math.random() * Math.max(1, canvasWidth - 100) + 50;
      const group = createFormationGroup(groupBaseX, currentY, groupSize, section.title, section.amount, type);
      collectibles.push(...group);
      section.spawned += group.length;
      itemsToPlace -= groupSize;
      currentY -= GROUP_SPACING;
      if (currentY < sectionBaseY - sectionHeight + 100) currentY = sectionBaseY - 50;
    }
  } else {
    section.pendingEnemies = Math.max(0, section.itemCount - section.spawned);
  }
  preloadedSections.add(sectionIndex);
}

export function getSectionIndexForY(y: number): number {
  const managerIndex = getSectionIndexForYFromManager(y);
  if (managerIndex !== -1) return managerIndex;

  if (!budgetSections.length) return -1;
  const feet = Math.max(0, Math.floor((groundY - y) / PIXELS_PER_FOOT));
  for (let i = 0; i < budgetSections.length; i++) {
    const section = budgetSections[i];
    if (feet >= section.startFeet && feet < section.endFeet) return i;
  }
  return -1;
}

  
