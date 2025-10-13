import type { Sprite } from '../../game_objects/sprite.js';
import type { Ride } from '../../game_objects/rides.js';
import type { Gate } from '../../game_objects/gates.js';
import type { ControlledGate } from '../../game_objects/controlledGate.js';
import type { InputHandler } from '../input.js';
import type { EnergyBar, Hearts } from '../../gui/hud.js';
import type { HeartPickup } from '../../game_objects/heartPickup.js';
import type { HeartEffectSystem } from '../controllers/heart_effects.js';
import type { WellExperience } from '../environment/well_experience.js';

export type GameMode = 'surface' | 'well';

export interface GameWorldState {
  sprite: Sprite | null;
  rides: Ride[];
  gates: Array<Gate | ControlledGate>;
  heartPickups: HeartPickup[];
  input: InputHandler | null;
  energyBar: EnergyBar | null;
  hearts: Hearts | null;
  heartEffects: HeartEffectSystem | null;
  lastTime: number;
  running: boolean;
  mode: GameMode;
  wellExperience: WellExperience | null;
}

export const gameWorld: GameWorldState = {
  sprite: null,
  rides: [],
  gates: [],
  heartPickups: [],
  input: null,
  energyBar: null,
  hearts: null,
  heartEffects: null,
  lastTime: 0,
  running: true,
  mode: 'surface',
  wellExperience: null
};

export function resetGameWorld(): void {
  gameWorld.heartEffects?.dispose();
  gameWorld.sprite = null;
  gameWorld.rides = [];
  gameWorld.gates = [];
  gameWorld.heartPickups = [];
  gameWorld.input = null;
  gameWorld.energyBar = null;
  gameWorld.hearts = null;
  gameWorld.heartEffects = null;
  gameWorld.lastTime = 0;
  gameWorld.running = true;
  gameWorld.mode = 'surface';
  gameWorld.wellExperience = null;
}
