import { GATE_GAP_WIDTH } from '../config/constants.js';
import { ControlledGate } from '../entities/controlledGate.js';
import { Gate } from '../entities/gates.js';
import type { CardDefinition } from './cardTypes.js';
import sampleCards from './sampleCardsDb.js';

export type CardGateInstance = ControlledGate | Gate;

export interface ActiveCard {
  definition: CardDefinition;
  order: number;
  bottomY: number;
  topY: number;
  height: number;
  gates: {
    top: CardGateInstance | null;
    right: CardGateInstance | null;
    bottom: CardGateInstance | null;
    left: CardGateInstance | null;
  };
  hasSpawnedEnemies: boolean;
  isProcedural: boolean;
}

interface CardStackContext {
  canvasWidth: number;
  canvasHeight: number;
  groundY: number;
}

let deck: CardDefinition[] = [];
let nextDefinitionIndex = 0;
let cardsCreated = 0;
let lastTopBoundary = 0;
let queue: ActiveCard[] = [];

function cloneDefinition(definition: CardDefinition): CardDefinition {
  return {
    ...definition,
    enemies: definition.enemies.map((enemy) => ({ ...enemy })),
    gates: {
      top: definition.gates?.top ?? null,
      right: definition.gates?.right ?? null,
      bottom: definition.gates?.bottom ?? null,
      left: definition.gates?.left ?? null,
    },
  };
}

export function initializeCardStack(context: CardStackContext): ActiveCard[] {
  deck = sampleCards.map(cloneDefinition);
  nextDefinitionIndex = 0;
  cardsCreated = 0;
  lastTopBoundary = context.groundY;
  queue = [];

  while (queue.length < 3) {
    const prev = queue[queue.length - 1] ?? null;
    const card = createCardInstance(prev, context.canvasWidth, context.canvasHeight);
    if (!card) break;
    queue.push(card);
  }

  return queue.slice();
}

export function updateCardWindow(
  spriteY: number,
  context: { canvasWidth: number; canvasHeight: number }
): { added: ActiveCard[]; removed: ActiveCard[]; currentCard: ActiveCard | null } {
  const removed: ActiveCard[] = [];

  while (queue.length > 0 && spriteY <= queue[0].topY) {
    const removedCard = queue.shift();
    if (!removedCard) break;
    removed.push(removedCard);
  }

  const added: ActiveCard[] = [];
  while (queue.length < 3) {
    const prev = queue[queue.length - 1] ?? null;
    const card = createCardInstance(prev, context.canvasWidth, context.canvasHeight);
    if (!card) break;
    queue.push(card);
    added.push(card);
  }

  const currentCard = queue[0] ?? null;
  return { added, removed, currentCard };
}

function createCardInstance(
  prev: ActiveCard | null,
  canvasWidth: number,
  canvasHeight: number
): ActiveCard | null {
  const definition = getNextDefinition();
  if (!definition) return null;

  const heightPct = Number.isFinite(definition.heightPct) ? definition.heightPct : 100;
  const clampedPct = Math.max(30, heightPct);
  const heightPx = (canvasHeight * clampedPct) / 100;

  const bottomY = prev ? prev.topY : lastTopBoundary;
  const topY = bottomY - heightPx;

  const topGate = createTopGateInstance(definition, topY, canvasWidth);

  const card: ActiveCard = {
    definition,
    order: cardsCreated,
    bottomY,
    topY,
    height: heightPx,
    gates: {
      top: topGate,
      right: null,
      bottom: prev?.gates.top ?? null,
      left: null,
    },
    hasSpawnedEnemies: false,
    isProcedural: Boolean(definition.procedural),
  };

  cardsCreated += 1;
  lastTopBoundary = topY;
  return card;
}

function getNextDefinition(): CardDefinition {
  if (nextDefinitionIndex < deck.length) {
    const definition = deck[nextDefinitionIndex];
    nextDefinitionIndex += 1;
    return definition;
  }

  const definition = generateRandomCardDefinition(nextDefinitionIndex);
  deck.push(definition);
  nextDefinitionIndex += 1;
  return definition;
}

function createTopGateInstance(
  definition: CardDefinition,
  y: number,
  canvasWidth: number
): CardGateInstance | null {
  const topDefinition = definition.gates?.top;
  if (topDefinition) {
    return new ControlledGate({ y, canvasWidth, definition: topDefinition });
  }

  const segmentCount = Math.floor(Math.random() * 3) + 1;
  return new Gate({
    y,
    canvasWidth,
    gapWidth: GATE_GAP_WIDTH,
    segmentCount,
  });
}

const PROCEDURAL_COLORS = ['#041c32', '#09203f', '#13274f', '#1f4068', '#222c5c'];

function generateRandomCardDefinition(index: number): CardDefinition {
  const heightPct = 80 + Math.floor(Math.random() * 50);
  const enemyCount = Math.floor(Math.random() * 5) + 1;
  const difficulty = Math.floor(Math.random() * 100) || 50;
  const paletteColor = PROCEDURAL_COLORS[index % PROCEDURAL_COLORS.length];

  return {
    id: `generated-${index + 1}`,
    title: `Procedural Card ${index + 1}`,
    heightPct,
    widthPct: 100,
    difficulty,
    gates: {
      top: null,
      right: null,
      bottom: null,
      left: null,
    },
    enemies: [
      {
        difficulty,
        count: Math.min(5, Math.max(1, enemyCount)),
      },
    ],
    theme: { bgColor: paletteColor },
    procedural: true,
  };
}

export function getActiveCards(): ActiveCard[] {
  return queue.slice();
}
