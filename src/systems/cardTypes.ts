import type { ControlledGateDefinition } from '../entities/controlledGate.js';

export interface CardEnemyDefinition {
  difficulty: number;
  count: number;
}

export interface CardGateDefinitions {
  top?: ControlledGateDefinition | null;
  right?: ControlledGateDefinition | null;
  bottom?: ControlledGateDefinition | null;
  left?: ControlledGateDefinition | null;
}

export interface CardThemeDefinition {
  bgColor?: string;
}

export interface CardDefinition {
  id: string;
  title: string;
  heightPct: number;
  widthPct?: number;
  difficulty?: number;
  gates: CardGateDefinitions;
  enemies: CardEnemyDefinition[];
  theme?: CardThemeDefinition;
  procedural?: boolean;
}
