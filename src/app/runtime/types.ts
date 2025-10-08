import type { GameCollection } from './collection';
import type { GameEngine } from './engine';
import type { GameObject } from './game-object';
import type { InputAction } from './input';

export interface Vector2 {
  x: number;
  y: number;
}

export interface Bounds {
  width: number;
  height: number;
}

export interface ScriptMessage<T = unknown> {
  targetId: string | '*';
  messageId: string;
  payload?: T;
  senderId?: string;
}

export interface ScriptContext<State> {
  readonly id: string;
  readonly engine: GameEngine;
  readonly collection: GameCollection;
  readonly object: GameObject<State>;
  readonly position: Vector2;
  readonly size: Bounds;
  readonly state: State;
  readonly properties: Record<string, unknown>;
  sendMessage<TMessage = unknown>(message: ScriptMessage<TMessage>): void;
  spawn?(object: GameObject): void;
}

export interface DefoldScript<State = Record<string, unknown>> {
  createState(): State;
  init?(context: ScriptContext<State>): void;
  update(context: ScriptContext<State>, dt: number): void;
  onMessage?(context: ScriptContext<State>, message: ScriptMessage): void;
  onInput?(context: ScriptContext<State>, action: InputAction): void;
  onFinal?(context: ScriptContext<State>): void;
  render?(context: ScriptContext<State>, ctx: CanvasRenderingContext2D): void;
}
