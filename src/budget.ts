import {
  TOTAL_ITEMS,
  MAX_ITEMS_PER_SECTION,
  GROUP_SPACING,
  ITEM_SPACING,
  PIXELS_PER_FOOT,
  DEFAULT_BUDGET_DATA,
  GATE_EVERY_FEET,
} from './constants.js';
import { Collectible, type CollectibleType, type GameStats } from './collectibles.js';
import { groundY, canvasWidth } from './globals.js';
import {
  sectionManager,
  type SectionDefinition,
  type SectionGateSpec,
} from './sections.js';

export type BudgetEntry = [string, number];

export interface BudgetSection {
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

export function resetBudgetContainers() {
  collectibles = [];
  preloadedSections = new Set();
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

export function calculateBudgetSections() {
  const totalAmount = budgetData.reduce((sum, [, amount]) => sum + Math.abs(amount), 0);
  budgetSections = [];
  gameStats = {} as GameStats;
  let currentFeet = 0;

  for (const [title, amount] of budgetData) {
    const percentage = totalAmount === 0 ? 0 : Math.abs(amount) / totalAmount;
    const itemCount = Math.round(TOTAL_ITEMS * percentage);
    const sectionsNeeded = Math.max(1, Math.ceil(itemCount / MAX_ITEMS_PER_SECTION));

    gameStats[title] = { target: amount, collected: 0, total: itemCount };

    for (let i = 0; i < sectionsNeeded; i++) {
      const itemsInThis = Math.min(MAX_ITEMS_PER_SECTION, itemCount - i * MAX_ITEMS_PER_SECTION);
      budgetSections.push({
        title,
        amount,
        itemCount: Math.max(0, itemsInThis),
        startFeet: currentFeet,
        endFeet: currentFeet + 100,
        spawned: 0,
        pendingEnemies: 0
      });
      currentFeet += 100;
    }
  }

  sectionManager.setDefinitions(createSectionDefinitionsFromBudget());
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

export function preloadSectionCollectibles(sectionIndex: number) {
  if (preloadedSections.has(sectionIndex)) return;
  const section = budgetSections[sectionIndex];
  if (!section) return;

  const sectionBaseY = groundY - section.startFeet * PIXELS_PER_FOOT;
  const sectionHeight = 100 * PIXELS_PER_FOOT;
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
  if (!budgetSections.length) return -1;
  const feet = Math.max(0, Math.floor((groundY - y) / PIXELS_PER_FOOT));
  for (let i = 0; i < budgetSections.length; i++) {
    const section = budgetSections[i];
    if (feet >= section.startFeet && feet < section.endFeet) return i;
  }
  return -1;
}

function createSectionDefinitionsFromBudget(): SectionDefinition[] {
  const definitions: SectionDefinition[] = [];
  let patternCursor = 0;

  for (let index = 0; index < budgetSections.length; index++) {
    const section = budgetSections[index];
    const heightFeet = Math.max(1, section.endFeet - section.startFeet);

    const gateSpecs: SectionGateSpec[] = [];
    let offsetFeet = GATE_EVERY_FEET;

    while (offsetFeet < heightFeet) {
      gateSpecs.push({
        id: `${section.startFeet + offsetFeet}`,
        offsetFeet,
        patternIndex: patternCursor,
        metadata: {
          budgetIndex: index,
          title: section.title,
        },
      });
      patternCursor += 1;
      offsetFeet += GATE_EVERY_FEET;
    }

    if (gateSpecs.length === 0) {
      const fallbackOffset = heightFeet / 2;
      gateSpecs.push({
        id: `${section.startFeet + fallbackOffset}`,
        offsetFeet: fallbackOffset,
        patternIndex: patternCursor,
        metadata: {
          budgetIndex: index,
          title: section.title,
        },
      });
      patternCursor += 1;
    }

    definitions.push({
      id: `${index}`,
      title: section.title ?? `Section ${index + 1}`,
      heightFeet,
      widthPercent: 100,
      difficulty: section.amount >= 0 ? 'intro' : 'standard',
      gates: { top: gateSpecs },
      collectibles: [],
      enemies: {},
      metadata: {
        budgetIndex: index,
        amount: section.amount,
        startFeet: section.startFeet,
        endFeet: section.endFeet,
        itemCount: section.itemCount,
      },
    });
  }

  return definitions;
}

  
