import { gameWorld } from "../state/game_state.js";
import { applyHelium as applyLumenHelium } from "../../game_objects/rides/lumen_loop.js";

/**
 * Lightweight helpers so pickups/UI can grant or query Lumen-Loop helium
 * without reaching directly into ride internals.
 */
export function grantLumenLoopHelium(amount: number): number {
  return applyLumenHelium(gameWorld.lumenLoop, amount);
}

export function getLumenLoopHelium(): number {
  return gameWorld.lumenLoop.heliumAmount;
}
