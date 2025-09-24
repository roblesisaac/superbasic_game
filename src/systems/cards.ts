import { GATE_THICKNESS } from '../config/constants.js';
import { canvasHeight, canvasWidth, groundY } from '../core/globals.js';
import {
  createGateForCardTop,
  resetCardGateFactory,
  getGateSeamSurfaceY
} from '../entities/gates.js';
import {
  spawnEnemiesForGate,
  enemies as activeEnemies
} from '../entities/enemies.js';
import type { EnemyActor } from '../entities/enemies.js';
import type { ControlledGateDefinition } from '../entities/controlledGate.js';
import { SAMPLE_CARDS } from './sampleCardsDb.js';
import { SeamFloor } from '../entities/seamFloor.js';
import { clamp } from '../utils/utils.js';

type GateInstance = ReturnType<typeof createGateForCardTop> | SeamFloor;

export interface CardEnemySpec {
  difficulty: number;
  count: number;
}

export interface CardTheme {
  bgColor?: string;
}

export interface CardGates {
  top?: ControlledGateDefinition | null;
  right?: ControlledGateDefinition | null;
  bottom?: ControlledGateDefinition | null;
  left?: ControlledGateDefinition | null;
}

export interface CardBlueprint {
  id?: string;
  title?: string;
  heightPct?: number;
  widthPct?: number;
  gates?: CardGates;
  enemies?: CardEnemySpec[];
  difficulty?: number;
  theme?: CardTheme;
}

export interface CardDefinition {
  id: string;
  title: string;
  heightPct: number;
  widthPct: number;
  gates: CardGates;
  enemies: CardEnemySpec[];
  difficulty?: number;
  theme: CardTheme;
}

export interface CardInstance {
  index: number;
  definition: CardDefinition;
  topY: number;
  bottomY: number;
  height: number;
  leftX: number;
  rightX: number;
  width: number;
  gateTop: GateInstance | null;
  gateBottom: GateInstance | null;
  seamFloor: SeamFloor | null;
  entryFloorY: number | null;
  enemiesSpawned: boolean;
  enemyActors: EnemyActor[];
}

export interface CardStackFrame {
  currentCard: CardInstance | null;
  visibleCards: CardInstance[];
  gates: GateInstance[];
}

const CARD_STACK_GAP = GATE_THICKNESS;
const MIN_CARD_HEIGHT = 64;

let cardDefinitions: CardDefinition[] = [];
let cardInstances: CardInstance[] = [];
let currentCard: CardInstance | null = null;
let visibleCards: CardInstance[] = [];

const FALLBACK_THEMES = ['#12304a', '#1c3d5a', '#243b4a', '#20314f', '#1a2b3f'];

function normalizeCard(input: CardBlueprint, index: number): CardDefinition {
  const enemies = Array.isArray(input.enemies) && input.enemies.length
    ? input.enemies.map(enemy => ({
        difficulty: typeof enemy.difficulty === 'number' ? enemy.difficulty : 50,
        count: Math.max(1, Math.min(5, Math.floor(enemy.count ?? 1)))
      }))
    : [{ difficulty: 50, count: 1 }];

  const gates: CardGates = {
    top: input.gates?.top ?? null,
    right: input.gates?.right ?? null,
    bottom: input.gates?.bottom ?? null,
    left: input.gates?.left ?? null
  };

  return {
    id: input.id ?? `card-${index}`,
    title: input.title ?? `Card ${index + 1}`,
    heightPct: typeof input.heightPct === 'number' ? input.heightPct : 100,
    widthPct: typeof input.widthPct === 'number' ? input.widthPct : 100,
    gates,
    enemies,
    difficulty: input.difficulty,
    theme: input.theme ?? {}
  };
}

function getCardDefinition(index: number): CardDefinition {
  if (index < cardDefinitions.length) {
    return cardDefinitions[index];
  }

  const definition = createRandomCard(index);
  cardDefinitions.push(definition);
  return definition;
}

function getCardByIndex(index: number): CardInstance | undefined {
  return cardInstances.find(card => card.index === index);
}

function findCardForY(y: number): CardInstance | undefined {
  return cardInstances.find(card => y >= card.topY && y <= card.bottomY);
}

function findNearestCard(y: number): CardInstance | null {
  if (!cardInstances.length) return null;

  let best: CardInstance | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const card of cardInstances) {
    let distance = 0;
    if (y < card.topY) distance = card.topY - y;
    else if (y > card.bottomY) distance = y - card.bottomY;

    if (distance < bestDistance) {
      bestDistance = distance;
      best = card;
    }
    if (distance === 0) break;
  }

  return best;
}

function ensureCard(index: number): CardInstance {
  const existing = getCardByIndex(index);
  if (existing) return existing;

  const definition = getCardDefinition(index);
  const previous = index > 0 ? getCardByIndex(index - 1) : undefined;
  const bottom = previous ? previous.topY - CARD_STACK_GAP : groundY;
  const heightPixels = Math.max(
    MIN_CARD_HEIGHT,
    (definition.heightPct / 100) * canvasHeight
  );
  const top = bottom - heightPixels;
  const widthPixels = Math.max(canvasWidth, (definition.widthPct / 100) * canvasWidth);
  const leftX = previous ? previous.leftX + (previous.width - widthPixels) / 2 : 0;
  const rightX = leftX + widthPixels;

  const gate = createGateForCardTop({
    y: top,
    width: widthPixels,
    originX: leftX,
    definition: definition.gates.top ?? null
  });

  let seamFloor: SeamFloor | null = null;
  let entryFloorY: number | null = null;

  const previousGate = previous?.gateTop;
  if (previousGate && !(previousGate instanceof SeamFloor)) {
    const seamY = getGateSeamSurfaceY(previousGate);
    seamFloor = new SeamFloor({ x: leftX, width: widthPixels, topY: seamY });
    entryFloorY = seamFloor.getTopY();
  } else {
    entryFloorY = top - GATE_THICKNESS / 2;
  }

  const card: CardInstance = {
    index,
    definition,
    topY: top,
    bottomY: bottom,
    height: heightPixels,
    leftX,
    rightX,
    width: widthPixels,
    gateTop: gate,
    gateBottom: previous?.gateTop ?? null,
    seamFloor,
    entryFloorY,
    enemiesSpawned: false,
    enemyActors: []
  };

  if (previous && !definition.gates.bottom) {
    definition.gates.bottom = previous.definition.gates.top ?? null;
  }

  cardInstances.push(card);
  cardInstances.sort((a, b) => a.index - b.index);
  return card;
}

function spawnEnemiesForCard(card: CardInstance): EnemyActor[] {
  if (card.enemiesSpawned) {
    return card.enemyActors;
  }

  card.enemiesSpawned = true;
  card.enemyActors = [];

  if (!card.gateTop) {
    return card.enemyActors;
  }

  for (const spec of card.definition.enemies) {
    const count = Math.max(0, Math.min(5, Math.floor(spec.count)));
    if (count <= 0) continue;
    const spawns = spawnEnemiesForGate(card.gateTop, { count, register: false });
    if (spawns.length) {
      card.enemyActors.push(...spawns);
    }
  }

  return card.enemyActors;
}

function cleanupInactiveCardEnemies() {
  for (const card of cardInstances) {
    if (!card.enemiesSpawned || card.enemyActors.length === 0) continue;
    card.enemyActors = card.enemyActors.filter(enemy => enemy && enemy.active !== false);
  }
}

function syncActiveEnemiesWithVisibleCards() {
  cleanupInactiveCardEnemies();

  const activationCards = new Set<CardInstance>(visibleCards);

  if (currentCard) {
    const previousCard = getCardByIndex(currentCard.index - 1);
    if (previousCard) {
      spawnEnemiesForCard(previousCard);
      activationCards.add(previousCard);
    }
  }

  const desired = new Set<EnemyActor>();
  for (const card of activationCards) {
    if (!card.enemyActors.length) continue;
    for (const enemy of card.enemyActors) {
      if (enemy && enemy.active !== false) desired.add(enemy);
    }
  }

  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    if (!desired.has(activeEnemies[i])) {
      activeEnemies.splice(i, 1);
    }
  }

  const activeSet = new Set(activeEnemies);
  for (const enemy of desired) {
    if (!activeSet.has(enemy)) {
      activeEnemies.push(enemy);
      activeSet.add(enemy);
    }
  }
}

function createRandomCard(index: number): CardDefinition {
  const heightPct = 80 + Math.floor(Math.random() * 50);
  const enemyCount = Math.floor(Math.random() * 5) + 1;
  const difficulty = Math.floor(Math.random() * 100) + 1;
  const theme = FALLBACK_THEMES[index % FALLBACK_THEMES.length];

  return normalizeCard(
    {
      id: `generated-${index}`,
      title: `Generated Card ${index + 1}`,
      heightPct,
      widthPct: 100,
      gates: {},
      enemies: [{ difficulty, count: enemyCount }],
      difficulty,
      theme: { bgColor: theme }
    },
    index
  );
}

function refreshVisibleCards(currentIndex: number) {
  const nextVisible: CardInstance[] = [];
  for (let offset = 0; offset < 3; offset++) {
    const card = getCardByIndex(currentIndex + offset);
    if (!card) continue;
    nextVisible.push(card);
    spawnEnemiesForCard(card);
  }

  visibleCards = nextVisible;
  syncActiveEnemiesWithVisibleCards();
}

function ensureCoverageForY(y: number) {
  if (!cardInstances.length) {
    ensureCard(0);
    ensureCard(1);
    ensureCard(2);
    return;
  }

  let highest = cardInstances[cardInstances.length - 1];
  while (highest && y < highest.topY) {
    ensureCard(highest.index + 1);
    highest = cardInstances[cardInstances.length - 1];
  }
}

export function initializeCardStack(startY: number): CardStackFrame {
  cardDefinitions = SAMPLE_CARDS.map((card, index) => normalizeCard(card, index));
  cardInstances = [];
  currentCard = null;
  visibleCards = [];

  resetCardGateFactory();

  ensureCard(0);
  ensureCard(1);
  ensureCard(2);

  return updateCardStack(startY);
}

export function updateCardStack(spriteY: number): CardStackFrame {
  ensureCoverageForY(spriteY);

  let nextCard = findCardForY(spriteY);
  if (!nextCard) {
    nextCard = findNearestCard(spriteY) ?? undefined;
  }

  currentCard = nextCard ?? currentCard ?? cardInstances[0] ?? null;
  const currentIndex = currentCard ? currentCard.index : 0;

  ensureCard(currentIndex + 1);
  ensureCard(currentIndex + 2);

  refreshVisibleCards(currentIndex);

  const gateSet = new Set<GateInstance>();
  if (currentCard?.gateBottom) gateSet.add(currentCard.gateBottom);
  if (currentCard?.seamFloor) gateSet.add(currentCard.seamFloor);

  for (const card of visibleCards) {
    if (card.gateTop) gateSet.add(card.gateTop);
    if (card.seamFloor) gateSet.add(card.seamFloor);
  }

  const gates = Array.from(gateSet);

  return {
    currentCard,
    visibleCards: [...visibleCards],
    gates
  };
}

export function getCurrentCard(): CardInstance | null {
  return currentCard;
}

export function getVisibleCards(): CardInstance[] {
  return [...visibleCards];
}

export function mapCardEntryX(
  x: number,
  fromCard: CardInstance,
  toCard: CardInstance
): number {
  if (!fromCard || !toCard) return x;
  const u = clamp((x - fromCard.leftX) / Math.max(1, fromCard.width), 0, 1);
  return toCard.leftX + u * toCard.width;
}

export function clampXToCard(
  x: number,
  card: CardInstance,
  halfWidth = 0
): number {
  if (!card) return x;
  const min = card.leftX + halfWidth;
  const max = card.rightX - halfWidth;
  if (min > max) return card.leftX + card.width / 2;
  return clamp(x, min, max);
}

export function getCardEntryFloorY(card: CardInstance): number {
  if (!card) return 0;
  if (typeof card.entryFloorY === 'number') return card.entryFloorY;
  return card.topY - GATE_THICKNESS / 2;
}
