import type { Sprite } from "../../game_objects/sprite.js";
import type { Ride } from "../../game_objects/rides.js";
import type { Gate } from "../../game_objects/gates.js";
import type { ControlledGate } from "../../game_objects/controlledGate.js";
import type { InputHandler } from "../input.js";
import type { EnergyBar, Hearts } from "../../gui/hud.js";
import type { HeartPickup } from "../../game_objects/heartPickup.js";
import type { HeartEffectSystem } from "../controllers/heart_effects.js";

export interface LumenLoopState {
  isUnlocked: boolean;
  isActive: boolean;
  angularVelocity: number;
  rotationAccum: number;
  haloScale: number;
  pinchIntent: number;
  heliumAmount: number;
  heliumFloatTimer: number;
  energy: number;
  cooldownTime: number;
}

export interface GameWorldState {
  sprite: Sprite | null;
  rides: Ride[];
  gates: Array<Gate | ControlledGate>;
  heartPickups: HeartPickup[];
  input: InputHandler | null;
  energyBar: EnergyBar | null;
  hearts: Hearts | null;
  heartEffects: HeartEffectSystem | null;
  lumenLoop: LumenLoopState;
  lastTime: number;
  running: boolean;
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
  lumenLoop: {
    isUnlocked: true,
    isActive: false,
    angularVelocity: 0,
    rotationAccum: 0,
    haloScale: 1.0,
    pinchIntent: 0,
    heliumAmount: 0,
    heliumFloatTimer: 0,
    energy: 100,
    cooldownTime: 0,
  },
  lastTime: 0,
  running: true,
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
  gameWorld.lumenLoop = {
    isUnlocked: true,
    isActive: false,
    angularVelocity: 0,
    rotationAccum: 0,
    haloScale: 1.0,
    pinchIntent: 0,
    heliumAmount: 0,
    heliumFloatTimer: 0,
    energy: 100,
    cooldownTime: 0,
  };
  gameWorld.lastTime = 0;
  gameWorld.running = true;
}
