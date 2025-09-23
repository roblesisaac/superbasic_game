import { GATE_THICKNESS } from '../config/constants.js';
import { canvasHeight, canvasWidth, groundY } from '../core/globals.js';
import {
  createGateForCardTop,
  resetCardGateFactory
} from '../entities/gates.js';
import { spawnEnemiesForGate } from '../entities/enemies.js';
import type { ControlledGateDefinition } from '../entities/controlledGate.js';
import { SAMPLE_CARDS } from './sampleCardsDb.js';

type GateInstance = ReturnType<typeof createGateForCardTop>;

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
  gateTop: GateInstance | null;
  enemiesSpawned: boolean;
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
  const gate = createGateForCardTop({
    y: top,
    canvasWidth,
    definition: definition.gates.top ?? null
  });

  const card: CardInstance = {
    index,
    definition,
    topY: top,
    bottomY: bottom,
    height: heightPixels,
    gateTop: gate,
    enemiesSpawned: false
  };

  cardInstances.push(card);
  cardInstances.sort((a, b) => a.index - b.index);
  return card;
}

function spawnEnemiesForCard(card: CardInstance) {
  if (!card.gateTop || card.enemiesSpawned) return;

  let spawned = 0;
  for (const spec of card.definition.enemies) {
    const count = Math.max(0, Math.min(5, Math.floor(spec.count)));
    if (count <= 0) continue;
    spawned += spawnEnemiesForGate(card.gateTop, { count });
  }

  card.enemiesSpawned = true;
  return spawned;
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
  visibleCards = [];
  for (let offset = 0; offset < 3; offset++) {
    const card = getCardByIndex(currentIndex + offset);
    if (card) {
      visibleCards.push(card);
      spawnEnemiesForCard(card);
    }
  }
}

function trimOldCards(currentIndex: number) {
  const minIndex = Math.max(0, currentIndex - 1);
  if (cardInstances.length && cardInstances[0].index < minIndex) {
    cardInstances = cardInstances.filter(card => card.index >= minIndex);
  }
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
  if (!nextCard && cardInstances.length) {
    const first = cardInstances[0];
    const last = cardInstances[cardInstances.length - 1];
    if (spriteY < first.topY) nextCard = first;
    else if (spriteY > last.bottomY) nextCard = last;
  }

  currentCard = nextCard ?? currentCard ?? cardInstances[0] ?? null;
  const currentIndex = currentCard ? currentCard.index : 0;

  ensureCard(currentIndex + 1);
  ensureCard(currentIndex + 2);

  trimOldCards(currentIndex);
  refreshVisibleCards(currentIndex);

  const gates = visibleCards
    .map(card => card.gateTop)
    .filter((gate): gate is GateInstance => Boolean(gate));

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
