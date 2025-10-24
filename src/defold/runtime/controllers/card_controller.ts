import {
  initializeCardStack,
  updateCardStack,
  type CardInstance,
} from "./card_stack.js";
import type { Gate } from "../../game_objects/gates.js";

let currentCard: CardInstance | null = null;

export function bootstrapCards(startY: number): {
  currentCard: CardInstance | null;
  gates: Gate[];
} {
  const frame = initializeCardStack(startY);
  currentCard = frame.currentCard;
  return { currentCard, gates: [...frame.gates] };
}

export function syncCards(spriteY: number): {
  currentCard: CardInstance | null;
  gates: Gate[];
} {
  const frame = updateCardStack(spriteY);
  currentCard = frame.currentCard;
  return { currentCard, gates: [...frame.gates] };
}

export function getCurrentCard(): CardInstance | null {
  return currentCard;
}

export function resetCardController(): void {
  currentCard = null;
}
